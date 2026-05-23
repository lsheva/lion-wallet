/**
 * Handler-layer helpers shared across `keyrings.ts` / `accounts.ts` / `state.ts` / etc.
 *
 * Lower-level keyring/vault primitives (the building blocks) live in
 * [`src/background/wallet-internal.ts`](../../wallet-internal.ts). This module
 * is only for the orchestration patterns that are specific to the message-handler
 * layer (e.g. "load encrypted vault, merge plaintext meta, persist back").
 */
import type { Address, Hex } from "viem";
import { formatProviderError } from "../../../shared/format";
import type { MessageResponse } from "../../../shared/messages";
import type { VaultData } from "../../../shared/types";
import * as keychain from "../../keychain";
import { bgLog } from "../../log";
import { decryptVault, loadAccountsMeta, type StorageMode } from "../../vault";
import {
  keyringsPublicWithFingerprints,
  persistKeychainFull,
  persistVaultModeFull,
} from "../../wallet-internal";

/**
 * Read the encrypted vault and overlay any plaintext labels/names from
 * `AccountsMeta`. The plaintext meta is the canonical UI label after the
 * popup mutates names without the password, so it wins over what the vault
 * had before encryption.
 */
function mergePlaintextMetaIntoVaultData(
  data: VaultData,
  meta: NonNullable<Awaited<ReturnType<typeof loadAccountsMeta>>>,
): VaultData {
  const accBy = new Map(meta.accounts.map((a) => [a.address.toLowerCase(), a]));
  const accounts = data.accounts.map((a) => {
    const m = accBy.get(a.address.toLowerCase());
    return m ? { ...a, ...m } : a;
  });
  const labelById = new Map(meta.keyrings.map((k) => [k.id, k.label]));
  const keyrings = data.keyrings.map((k) => {
    const L = labelById.get(k.id);
    return L ? { ...k, label: L } : k;
  });
  return { ...data, accounts, keyrings };
}

/** Decrypt the vault and merge plaintext meta labels into the result. */
export async function loadVaultForMerge(password: string): Promise<VaultData> {
  const meta = await loadAccountsMeta();
  const data = await decryptVault(password);
  return meta ? mergePlaintextMetaIntoVaultData(data, meta) : data;
}

/**
 * Persist the merged vault. In keychain mode there is no encrypted vault to
 * write — the helper falls back to keychain-style persistence.
 */
export async function persistMergedVault(
  data: VaultData,
  password: string | undefined,
  keyringsPublic: Awaited<ReturnType<typeof keyringsPublicWithFingerprints>>,
): Promise<MessageResponse> {
  if (!password) {
    return persistKeychainFull(data, keyringsPublic);
  }
  await persistVaultModeFull(data, password, keyringsPublic);
  return { ok: true };
}

/**
 * Re-export so handlers can `import { keyringsPublicWithFingerprints } from "./_shared"`
 * without reaching into `wallet-internal.ts` directly.
 */
export { keyringsPublicWithFingerprints };

/** Pull a private key for an imported address from keychain or the encrypted vault. */
export async function retrieveImportedKey(
  mode: StorageMode,
  address: Address,
  password?: string,
  reason?: string,
): Promise<Hex | null> {
  if (mode === "keychain") {
    return keychain.retrieveImportedKey(address, reason);
  }
  if (!password) return null;
  const data = await decryptVault(password);
  if (!data.importedKeys) return null;
  return (data.importedKeys[address.toLowerCase()] as Hex) ?? null;
}

/**
 * Build the typed "accounts changed" payload + emit on the broadcast channel.
 * Centralized so every keyring/account mutation broadcasts the same shape.
 */
export function broadcastAccounts(
  broadcast: (event: string, data: unknown) => void,
  accounts: { address: Address }[],
): void {
  broadcast(
    "accountsChanged",
    accounts.map((a) => a.address),
  );
}

/** Filter helper used when assembling new vaults from scratch. */
export function partitionKeyrings<T extends { type: "hd" | "imported" }>(
  keyrings: T[],
): { hd: Extract<T, { type: "hd" }>[]; imp: Extract<T, { type: "imported" }>[] } {
  return {
    hd: keyrings.filter((k): k is Extract<T, { type: "hd" }> => k.type === "hd"),
    imp: keyrings.filter((k): k is Extract<T, { type: "imported" }> => k.type === "imported"),
  };
}

/** Common "wallet not initialized" early-return shape. */
export type RequireMetaResult =
  | { ok: true; meta: NonNullable<Awaited<ReturnType<typeof loadAccountsMeta>>> }
  | { ok: false; response: MessageResponse };

export async function requireMeta(
  errorMessage = "Wallet not initialized",
): Promise<RequireMetaResult> {
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, response: { ok: false, error: errorMessage } };
  return { ok: true, meta };
}

/**
 * Wrap a handler that returns the success-payload directly (or throws) into
 * one that conforms to `MessageResponse`. Handlers using this helper:
 *
 * - Throw `Error` for failure paths; the wrapper logs via `bgLog` and turns
 *   the message into the typed `{ ok: false, error }` shape.
 * - Return any payload directly; the wrapper wraps it in `{ ok: true, data }`.
 *
 * Existing handlers that already return `MessageResponse` are left unchanged;
 * adopt this for new handlers where it removes boilerplate.
 *
 * ```ts
 * export const handleFoo = defineHandler("FOO", async (msg: { x: number }) => {
 *   const meta = await requireMetaOrThrow();
 *   return { result: meta.accounts.length + msg.x };
 * });
 * ```
 */
export function defineHandler<TInput, TOutput>(
  label: string,
  fn: (input: TInput) => Promise<TOutput>,
): (input: TInput) => Promise<MessageResponse> {
  return async (input: TInput): Promise<MessageResponse> => {
    try {
      const data = await fn(input);
      return { ok: true, data };
    } catch (e) {
      const error = formatProviderError(e) || (e instanceof Error ? e.message : String(e));
      bgLog(`[handler:${label}]`, e);
      return { ok: false, error };
    }
  };
}
