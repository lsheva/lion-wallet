/**
 * HD account derivation, rename, remove, switch — and the listing endpoints
 * (`GET_ACCOUNTS`).
 *
 * Mutations branch on storage mode and use the `_shared.ts` helpers.
 */
import type { Address } from "viem";
import { IMPORTED_KEYRING_ID } from "../../../shared/keyring-constants";
import type { MessageResponse } from "../../../shared/messages";
import type { KeyringStored, VaultData } from "../../../shared/types";
import { getActiveAccount, visibleAccounts } from "../../account-utils";
import { broadcastEvent } from "../../broadcast";
import * as keychain from "../../keychain";
import { getStorageMode, loadAccountsMeta, saveAccountsMeta } from "../../vault";
import * as wallet from "../../wallet";
import {
  mergeHdMapAfterImport,
  nextHdIndexForKeyring,
  retrieveHdMnemonicForKeyring,
} from "../../wallet-internal";
import {
  broadcastAccounts,
  keyringsPublicWithFingerprints,
  loadVaultForMerge,
  persistMergedVault,
  requireMeta,
} from "./_shared";

export async function handleDeriveAccount(
  keyringId: string,
  password?: string,
): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const m = await requireMeta();
  if (!m.ok) return m.response;
  const meta = m.meta;
  if (keyringId === IMPORTED_KEYRING_ID) {
    return { ok: false, error: "Cannot derive from imported keyring" };
  }
  const mnemonic = await retrieveHdMnemonicForKeyring(
    mode,
    keyringId,
    password,
    "Derive a new account",
  );
  const nextIndex = nextHdIndexForKeyring(meta.accounts, keyringId);
  const account = wallet.deriveAccount(mnemonic, nextIndex, keyringId);

  if (mode === "keychain") {
    const nextAccounts = [...meta.accounts, account];
    await saveAccountsMeta(nextAccounts, meta.activeAccountAddress, meta.keyrings);
    await mergeHdMapAfterImport(keyringId, mnemonic);
    broadcastAccounts(broadcastEvent, nextAccounts);
    return { ok: true, data: { account } };
  }

  if (!password) return { ok: false, error: "Password required" };
  let data: VaultData;
  try {
    data = await loadVaultForMerge(password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const nextAccounts = [...data.accounts, account];
  const nextKeyrings = data.keyrings.map((k) => {
    if (k.type === "hd" && k.id === keyringId) {
      return { ...k, nextDerivationIndex: nextIndex + 1 };
    }
    return k;
  }) as KeyringStored[];
  const vault: VaultData = {
    ...data,
    accounts: nextAccounts,
    keyrings: nextKeyrings,
    activeAccountAddress: data.activeAccountAddress,
  };
  const kp = await keyringsPublicWithFingerprints(vault.keyrings);
  const res = await persistMergedVault(vault, password, kp);
  if (!res.ok) return res;
  await mergeHdMapAfterImport(keyringId, mnemonic);
  broadcastAccounts(broadcastEvent, nextAccounts);
  return { ok: true, data: { account } };
}

export async function handleAddAccount(password?: string): Promise<MessageResponse> {
  const m = await requireMeta();
  if (!m.ok) return m.response;
  const active = getActiveAccount(m.meta);
  if (!active || active.path === "imported") {
    return {
      ok: false,
      error: "Select an HD account, or use Settings → Derive account for a specific keyring",
    };
  }
  return handleDeriveAccount(active.keyringId, password);
}

export async function handleRenameAccount(
  address: Address,
  name: string,
): Promise<MessageResponse> {
  const m = await requireMeta("No wallet");
  if (!m.ok) return m.response;
  const meta = m.meta;
  const acc = meta.accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
  if (!acc || acc.hidden) return { ok: false, error: "Account not found" };
  const trimmed = name.trim();
  const next = meta.accounts.map((a) =>
    a.address.toLowerCase() === address.toLowerCase() ? { ...a, name: trimmed || a.name } : a,
  );
  await saveAccountsMeta(next, meta.activeAccountAddress, meta.keyrings);
  return { ok: true };
}

export async function handleRemoveAccount(
  address: Address,
  password: string | undefined,
): Promise<MessageResponse> {
  const m = await requireMeta("No wallet");
  if (!m.ok) return m.response;
  const meta = m.meta;
  const lower = address.toLowerCase();
  const acc = meta.accounts.find((a) => a.address.toLowerCase() === lower);
  if (!acc) return { ok: false, error: "Account not found" };
  if (acc.hidden) return { ok: false, error: "Account not found" };
  if (visibleAccounts(meta.accounts).length <= 1) {
    return { ok: false, error: "Cannot remove the only account — use Reset wallet" };
  }

  const remainingAccounts = meta.accounts.filter((a) => a.address.toLowerCase() !== lower);
  const mode = await getStorageMode();

  if (acc.path === "imported") {
    let active = meta.activeAccountAddress;
    if (active.toLowerCase() === lower) {
      const next = visibleAccounts(remainingAccounts)[0];
      if (next === undefined) return { ok: false, error: "Could not pick a new active account" };
      active = next.address;
    }

    if (mode === "keychain") {
      await keychain.deleteImportedKey(acc.address);
      let kp = meta.keyrings;
      if (!remainingAccounts.some((a) => a.path === "imported")) {
        kp = meta.keyrings.filter((k) => k.id !== IMPORTED_KEYRING_ID);
      }
      await saveAccountsMeta(remainingAccounts, active, kp);
      broadcastAccounts(broadcastEvent, visibleAccounts(remainingAccounts));
      return { ok: true };
    }
    if (!password) return { ok: false, error: "Password required" };
    let data: VaultData;
    try {
      data = await loadVaultForMerge(password);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    const nextAccounts = data.accounts.filter((a) => a.address.toLowerCase() !== lower);
    const mergedImported = { ...(data.importedKeys ?? {}) };
    delete mergedImported[acc.address.toLowerCase()];
    const nextImportedKeys = Object.keys(mergedImported).length > 0 ? mergedImported : undefined;
    let nextKeyrings = data.keyrings;
    if (!nextAccounts.some((a) => a.path === "imported")) {
      nextKeyrings = data.keyrings.filter((k) => k.type !== "imported");
    }
    const nextVault: VaultData = {
      keyrings: nextKeyrings,
      accounts: nextAccounts,
      activeAccountAddress: active,
      ...(nextImportedKeys ? { importedKeys: nextImportedKeys } : {}),
    };
    const kp = await keyringsPublicWithFingerprints(nextVault.keyrings);
    const res = await persistMergedVault(nextVault, password, kp);
    if (!res.ok) return res;
    broadcastAccounts(broadcastEvent, visibleAccounts(nextAccounts));
    return { ok: true };
  }

  // HD account: soft-remove via `hidden=true` so the BIP-44 slot is preserved
  // for chain-discovery tombstones.
  const nextAccountsHd = meta.accounts.map((a) =>
    a.address.toLowerCase() === lower ? { ...a, hidden: true } : a,
  );
  let activeHd = meta.activeAccountAddress;
  if (activeHd.toLowerCase() === lower) {
    const next = visibleAccounts(nextAccountsHd)[0];
    if (next === undefined) return { ok: false, error: "Could not pick a new active account" };
    activeHd = next.address;
  }

  if (mode === "keychain") {
    await saveAccountsMeta(nextAccountsHd, activeHd, meta.keyrings);
    broadcastAccounts(broadcastEvent, visibleAccounts(nextAccountsHd));
    return { ok: true };
  }

  if (!password) return { ok: false, error: "Password required" };
  let data: VaultData;
  try {
    data = await loadVaultForMerge(password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const nextVaultAccounts = data.accounts.map((a) =>
    a.address.toLowerCase() === lower ? { ...a, hidden: true } : a,
  );
  const nextVault: VaultData = {
    ...data,
    accounts: nextVaultAccounts,
    activeAccountAddress: activeHd,
  };
  const kp = await keyringsPublicWithFingerprints(nextVault.keyrings);
  const res = await persistMergedVault(nextVault, password, kp);
  if (!res.ok) return res;
  broadcastAccounts(broadcastEvent, visibleAccounts(nextVaultAccounts));
  return { ok: true };
}

export async function handleSwitchAccount(activeAccountAddress: Address): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  if (meta) {
    if (
      !visibleAccounts(meta.accounts).some(
        (a) => a.address.toLowerCase() === activeAccountAddress.toLowerCase(),
      )
    ) {
      return { ok: false, error: "Unknown account" };
    }
    await saveAccountsMeta(meta.accounts, activeAccountAddress, meta.keyrings);
    broadcastAccounts(broadcastEvent, visibleAccounts(meta.accounts));
  }
  return { ok: true };
}

export async function handleGetAccounts(): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  return { ok: true, data: { accounts: visibleAccounts(meta?.accounts ?? []) } };
}
