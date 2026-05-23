/**
 * Vault + accounts-meta storage.
 *
 * Two storage modes (see AGENTS.md → "Storage modes"):
 * - `keychain`: secrets live in macOS Keychain; this module only stores public meta.
 * - `vault`:    PBKDF2(600k) + AES-GCM blob in `browser.storage.local` keyed by
 *               `VAULT_KEY`; password required for every signing/export op.
 *
 * `AccountsMeta` (unencrypted) mirrors the public account/keyring rows so the
 * popup can render without authentication; `VaultData` (encrypted) carries the
 * mnemonics and imported private keys.
 */
import type { Address } from "viem";
import type { EncryptedVault, KeyringPublic, SerializedAccount, VaultData } from "../shared/types";
import { normalizeVaultData } from "../shared/vault-migrate";

const VAULT_KEY = "vault";
const ACCOUNTS_META_KEY = "accountsMeta";
const STORAGE_MODE_KEY = "storageMode";
const PBKDF2_ITERATIONS = 600_000;

export type StorageMode = "keychain" | "vault";

// ── Account metadata (always available, unencrypted) ────────────────

export interface AccountsMeta {
  accounts: SerializedAccount[];
  activeAccountAddress: Address;
  keyrings: KeyringPublic[];
  /** Lowercase addresses that have shown balance/nonce in discovery; skip RPC for visible index 0 on new chains. */
  discoverySeenActivityAddresses?: string[];
}

export async function saveAccountsMeta(
  accounts: SerializedAccount[],
  activeAccountAddress: Address,
  keyrings: KeyringPublic[],
  discoverySeenActivityAddresses?: string[],
): Promise<void> {
  const existing = await loadAccountsMeta();
  const mergedSeen =
    discoverySeenActivityAddresses !== undefined
      ? discoverySeenActivityAddresses
      : existing?.discoverySeenActivityAddresses;
  await browser.storage.local.set({
    [ACCOUNTS_META_KEY]: {
      accounts,
      activeAccountAddress,
      keyrings,
      ...(mergedSeen?.length ? { discoverySeenActivityAddresses: mergedSeen } : {}),
    } satisfies AccountsMeta,
  });
}

export async function loadAccountsMeta(): Promise<AccountsMeta | null> {
  const result = await browser.storage.local.get(ACCOUNTS_META_KEY);
  const raw = result[ACCOUNTS_META_KEY];
  if (!raw || typeof raw !== "object") return null;
  const r = raw as AccountsMeta;
  if (
    !r.accounts?.length ||
    !r.activeAccountAddress ||
    !Array.isArray(r.keyrings) ||
    r.keyrings.length === 0
  ) {
    return null;
  }
  return r;
}

// ── Storage mode ────────────────────────────────────────────────────

export async function getStorageMode(): Promise<StorageMode> {
  const result = await browser.storage.local.get(STORAGE_MODE_KEY);
  return (result[STORAGE_MODE_KEY] as StorageMode) ?? "vault";
}

export async function setStorageMode(mode: StorageMode): Promise<void> {
  await browser.storage.local.set({ [STORAGE_MODE_KEY]: mode });
}

// ── Encrypted vault ─────────────────────────────────────────────────

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVault(data: VaultData, password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt.buffer);

  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const vault: EncryptedVault = {
    salt: toBase64(salt.buffer),
    iv: toBase64(iv.buffer),
    ciphertext: toBase64(ciphertext),
  };

  await browser.storage.local.set({ [VAULT_KEY]: vault });
}

export async function decryptVault(password: string): Promise<VaultData> {
  const result = await browser.storage.local.get(VAULT_KEY);
  const vault = result[VAULT_KEY] as EncryptedVault | undefined;
  if (!vault) throw new Error("No vault found");

  const salt = fromBase64(vault.salt);
  const iv = fromBase64(vault.iv);
  const ciphertext = fromBase64(vault.ciphertext);

  const key = await deriveKey(password, salt);

  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("Wrong password");
  }

  return normalizeVaultData(JSON.parse(new TextDecoder().decode(decrypted)));
}

export async function isVaultInitialized(): Promise<boolean> {
  const meta = await loadAccountsMeta();
  return meta != null && meta.accounts.length > 0;
}

export async function clearVault(): Promise<void> {
  await browser.storage.local.remove([VAULT_KEY, ACCOUNTS_META_KEY, STORAGE_MODE_KEY]);
}
