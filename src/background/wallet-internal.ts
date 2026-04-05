import type { Address, Hex } from "viem";

import type { MessageResponse } from "../shared/messages";
import { IMPORTED_KEYRING_ID } from "../shared/keyring-constants";
import type {
  HdKeyringStored,
  ImportedKeyringStored,
  KeyringPublic,
  KeyringStored,
  SerializedAccount,
  VaultData,
} from "../shared/types";
import { mnemonicFingerprint } from "../shared/mnemonic-fingerprint";
import * as keychain from "./keychain";
import {
  clearHdDerivedAddresses,
  deriveHdAddressList,
  loadHdDerivedAddressMap,
  saveHdDerivedAddressMap,
} from "./hd-addresses";
import { bgLog } from "./log";
import { decryptVault, encryptVault, setStorageMode, type StorageMode } from "./vault";
/** Insert an HD keyring row after existing HD rows, before imported rows. */
export function insertHdKeyringPublic(existing: KeyringPublic[], row: KeyringPublic): KeyringPublic[] {
  const hds = existing.filter((k) => k.type === "hd");
  const imp = existing.filter((k) => k.type === "imported");
  return [...hds, row, ...imp];
}

export async function keyringsPublicWithFingerprints(
  keyrings: KeyringStored[],
): Promise<KeyringPublic[]> {
  const out: KeyringPublic[] = [];
  for (const k of keyrings) {
    if (k.type === "hd") {
      out.push({
        id: k.id,
        label: k.label,
        type: "hd",
        mnemonicFingerprint: await mnemonicFingerprint(k.mnemonic),
      });
    } else {
      out.push({ id: k.id, label: k.label, type: "imported" });
    }
  }
  return out;
}

export async function retrieveHdMnemonicForKeyring(
  mode: StorageMode,
  keyringId: string,
  password: string | undefined,
  reason: string | undefined,
): Promise<string> {
  if (mode === "keychain") {
    const m = await keychain.retrieveMnemonicForKeyring(keyringId, reason);
    if (!m) throw new Error("Authentication failed or cancelled");
    return m;
  }
  if (!password) throw new Error("Password required");
  const data = await decryptVault(password);
  const kr = data.keyrings.find(
    (k): k is HdKeyringStored => k.type === "hd" && k.id === keyringId,
  );
  if (!kr) throw new Error("HD keyring not found");
  return kr.mnemonic;
}

export function nextHdIndexForKeyring(
  accounts: SerializedAccount[],
  keyringId: string,
): number {
  const idxs = accounts
    .filter((a) => a.path !== "imported" && a.keyringId === keyringId)
    .map((a) => a.index);
  return idxs.length > 0 ? Math.max(...idxs) + 1 : 0;
}

export function nextImportIndex(accounts: SerializedAccount[]): number {
  const idxs = accounts.filter((a) => a.path === "imported").map((a) => a.index);
  return idxs.length > 0 ? Math.max(...idxs) + 1 : 0;
}

export function ensureImportedKeyringPublic(keyrings: KeyringPublic[]): KeyringPublic[] {
  if (keyrings.some((k) => k.id === IMPORTED_KEYRING_ID)) return keyrings;
  return [
    ...keyrings,
    { id: IMPORTED_KEYRING_ID, label: "Imported", type: "imported" as const },
  ];
}

async function storeHdDerivedSlice(keyringId: string, mnemonic: string): Promise<void> {
  const map = (await loadHdDerivedAddressMap()) ?? {};
  map[keyringId] = deriveHdAddressList(mnemonic, keyringId);
  await saveHdDerivedAddressMap(map);
}

export async function persistVaultModeFull(
  data: VaultData,
  password: string,
  keyringsPublic: KeyringPublic[],
): Promise<void> {
  await setStorageMode("vault");
  await encryptVault(data, password);
  const { saveAccountsMeta } = await import("./vault");
  await saveAccountsMeta(data.accounts, data.activeAccountAddress, keyringsPublic);
  const hd = data.keyrings.filter((k): k is HdKeyringStored => k.type === "hd");
  const map = (await loadHdDerivedAddressMap()) ?? {};
  for (const k of hd) {
    map[k.id] = deriveHdAddressList(k.mnemonic, k.id);
  }
  if (Object.keys(map).length > 0) await saveHdDerivedAddressMap(map);
}

export async function persistKeychainFull(
  data: VaultData,
  keyringsPublic: KeyringPublic[],
): Promise<MessageResponse> {
  const probe = await keychain.isKeychainAvailable();
  if (!probe.available) {
    return { ok: false, error: `Keychain not available: ${probe.error ?? "probe returned false"}` };
  }
  const auth = await keychain.authenticateUser("Save your wallet to secure storage");
  if (!auth.ok) {
    return { ok: false, error: auth.error ?? "Authentication failed or cancelled" };
  }
  for (const k of data.keyrings) {
    if (k.type === "hd") {
      const res = await keychain.storeMnemonicForKeyring(k.id, k.mnemonic);
      if (!res.ok) return { ok: false, error: `Keychain store failed: ${res.error}` };
    }
  }
  if (data.importedKeys) {
    for (const [addr, pk] of Object.entries(data.importedKeys)) {
      const keyRes = await keychain.storeImportedKey(addr as Address, pk as Hex);
      if (!keyRes.ok) return { ok: false, error: `Keychain store failed: key: ${keyRes.error}` };
    }
  }
  await setStorageMode("keychain");
  const { saveAccountsMeta } = await import("./vault");
  await saveAccountsMeta(data.accounts, data.activeAccountAddress, keyringsPublic);
  const hd = data.keyrings.filter((k): k is HdKeyringStored => k.type === "hd");
  const map = (await loadHdDerivedAddressMap()) ?? {};
  for (const k of hd) {
    map[k.id] = deriveHdAddressList(k.mnemonic, k.id);
  }
  if (Object.keys(map).length > 0) await saveHdDerivedAddressMap(map);
  return { ok: true };
}

export async function persistFreshWallet(
  data: VaultData,
  password: string | undefined,
  label: string,
): Promise<MessageResponse> {
  const kp = await keyringsPublicWithFingerprints(data.keyrings);
  if (!password) {
    const res = await persistKeychainFull(data, kp);
    if (!res.ok) return res;
  } else {
    await persistVaultModeFull(data, password, kp);
  }
  bgLog(`[${label}] persisted wallet, accounts=${data.accounts.length}`);
  return { ok: true };
}

export function buildHdKeyring(
  mnemonic: string,
  id: string,
  label: string,
  accounts: SerializedAccount[],
): HdKeyringStored {
  const maxIdx = Math.max(
    -1,
    ...accounts.filter((a) => a.keyringId === id && a.path !== "imported").map((a) => a.index),
  );
  return {
    type: "hd",
    id,
    label,
    mnemonic,
    nextDerivationIndex: maxIdx + 1,
    createdAt: Date.now(),
  };
}

export function importedKeyringMeta(label = "Imported"): ImportedKeyringStored {
  return {
    type: "imported",
    id: IMPORTED_KEYRING_ID,
    label,
    createdAt: Date.now(),
  };
}

export async function mergeHdMapAfterImport(
  keyringId: string,
  mnemonic: string,
): Promise<void> {
  await storeHdDerivedSlice(keyringId, mnemonic);
}

export { clearHdDerivedAddresses, deriveHdAddressList, loadHdDerivedAddressMap };
