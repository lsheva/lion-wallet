/**
 * Wallet creation, import, keyring add/rename/delete, and private-key import.
 *
 * Every mutation here goes through `_shared.ts` helpers so the keychain-mode
 * vs vault-mode branching stays uniform across handlers.
 */
import type { Hex } from "viem";
import { IMPORTED_KEYRING_ID } from "../../../shared/keyring-constants";
import type { MessageResponse } from "../../../shared/messages";
import { mnemonicFingerprint } from "../../../shared/mnemonic-fingerprint";
import type {
  KeyringPublic,
  KeyringStored,
  SerializedAccount,
  VaultData,
} from "../../../shared/types";
import { broadcastEvent } from "../../broadcast";
import { loadHdDerivedAddressMap, saveHdDerivedAddressMap } from "../../hd-addresses";
import * as keychain from "../../keychain";
import {
  getStorageMode,
  isVaultInitialized,
  loadAccountsMeta,
  saveAccountsMeta,
} from "../../vault";
import * as wallet from "../../wallet";
import {
  buildHdKeyring,
  ensureImportedKeyringPublic,
  importedKeyringMeta,
  insertHdKeyringPublic,
  mergeHdMapAfterImport,
  nextImportIndex,
  persistFreshWallet,
} from "../../wallet-internal";
import {
  broadcastAccounts,
  keyringsPublicWithFingerprints,
  loadVaultForMerge,
  partitionKeyrings,
  persistMergedVault,
  requireMeta,
} from "./_shared";

export async function handleCreateWallet(password?: string): Promise<MessageResponse> {
  if (await isVaultInitialized()) {
    return { ok: false, error: "Wallet already exists" };
  }
  const keyringId = crypto.randomUUID();
  const mnemonic = wallet.createMnemonic();
  const acc = wallet.deriveAccount(mnemonic, 0, keyringId);
  const hd = buildHdKeyring(mnemonic, keyringId, "Main Wallet", [acc]);
  const vault: VaultData = {
    keyrings: [hd],
    accounts: [acc],
    activeAccountAddress: acc.address,
  };
  const res = await persistFreshWallet(vault, password, "create");
  if (!res.ok) return res;
  broadcastEvent("accountsChanged", [acc.address]);
  return { ok: true, data: { mnemonic, accounts: vault.accounts } };
}

export async function handleAddKeyringCreate(password?: string): Promise<MessageResponse> {
  if (!(await isVaultInitialized())) {
    return { ok: false, error: "Create a wallet first" };
  }
  const m = await requireMeta();
  if (!m.ok) return m.response;
  const meta = m.meta;
  const mode = await getStorageMode();
  const mnemonic = wallet.createMnemonic();
  const keyringId = crypto.randomUUID();
  const acc = wallet.deriveAccount(mnemonic, 0, keyringId);
  const fp = await mnemonicFingerprint(mnemonic);

  if (mode === "keychain") {
    const auth = await keychain.authenticateUser("Add wallet to secure storage");
    if (!auth.ok) {
      return { ok: false, error: auth.error ?? "Authentication failed or cancelled" };
    }
    const storeRes = await keychain.storeMnemonicForKeyring(keyringId, mnemonic);
    if (!storeRes.ok) {
      return { ok: false, error: storeRes.error ?? "Keychain store failed" };
    }
    const newKp: KeyringPublic = {
      id: keyringId,
      label: "New wallet",
      type: "hd",
      mnemonicFingerprint: fp,
    };
    const kp = insertHdKeyringPublic(meta.keyrings, newKp);
    const mergedAccounts = [...meta.accounts, acc];
    await saveAccountsMeta(mergedAccounts, meta.activeAccountAddress, kp);
    await mergeHdMapAfterImport(keyringId, mnemonic);
    broadcastAccounts(broadcastEvent, mergedAccounts);
    return { ok: true, data: { mnemonic, accounts: mergedAccounts, keyrings: kp } };
  }

  if (!password) return { ok: false, error: "Password required" };
  const newHd = buildHdKeyring(mnemonic, keyringId, "New wallet", [acc]);
  let data: VaultData;
  try {
    data = await loadVaultForMerge(password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const { hd: hds, imp } = partitionKeyrings(data.keyrings);
  const mergedVault: VaultData = {
    keyrings: [...hds, newHd, ...imp],
    accounts: [...data.accounts, acc],
    activeAccountAddress: data.activeAccountAddress,
    ...(data.importedKeys ? { importedKeys: data.importedKeys } : {}),
  };
  const kp = await keyringsPublicWithFingerprints(mergedVault.keyrings);
  const res = await persistMergedVault(mergedVault, password, kp);
  if (!res.ok) return res;
  await mergeHdMapAfterImport(keyringId, mnemonic);
  broadcastAccounts(broadcastEvent, mergedVault.accounts);
  return { ok: true, data: { mnemonic, accounts: mergedVault.accounts, keyrings: kp } };
}

export async function handleAddKeyringImport(
  mnemonic: string,
  password: string | undefined,
): Promise<MessageResponse> {
  if (!(await isVaultInitialized())) {
    return handleImportWallet(mnemonic, password);
  }
  const m = await requireMeta();
  if (!m.ok) return m.response;
  const meta = m.meta;
  const fp = await mnemonicFingerprint(mnemonic);
  if (meta.keyrings.some((k) => k.type === "hd" && k.mnemonicFingerprint === fp)) {
    return { ok: false, error: "This recovery phrase is already in the wallet" };
  }
  const mode = await getStorageMode();
  const keyringId = crypto.randomUUID();
  const acc = wallet.deriveAccount(mnemonic, 0, keyringId);

  if (mode === "keychain") {
    const auth = await keychain.authenticateUser("Import wallet to secure storage");
    if (!auth.ok) {
      return { ok: false, error: auth.error ?? "Authentication failed or cancelled" };
    }
    const storeRes = await keychain.storeMnemonicForKeyring(keyringId, mnemonic);
    if (!storeRes.ok) {
      return { ok: false, error: storeRes.error ?? "Keychain store failed" };
    }
    const newKp: KeyringPublic = {
      id: keyringId,
      label: "Imported wallet",
      type: "hd",
      mnemonicFingerprint: fp,
    };
    const kp = insertHdKeyringPublic(meta.keyrings, newKp);
    const mergedAccounts = [...meta.accounts, acc];
    await saveAccountsMeta(mergedAccounts, meta.activeAccountAddress, kp);
    await mergeHdMapAfterImport(keyringId, mnemonic);
    broadcastAccounts(broadcastEvent, mergedAccounts);
    return { ok: true, data: { accounts: mergedAccounts, keyrings: kp } };
  }

  if (!password) return { ok: false, error: "Password required" };
  const newHd = buildHdKeyring(mnemonic, keyringId, "Imported wallet", [acc]);
  let data: VaultData;
  try {
    data = await loadVaultForMerge(password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const { hd: hds, imp } = partitionKeyrings(data.keyrings);
  const mergedVault: VaultData = {
    keyrings: [...hds, newHd, ...imp],
    accounts: [...data.accounts, acc],
    activeAccountAddress: data.activeAccountAddress,
    ...(data.importedKeys ? { importedKeys: data.importedKeys } : {}),
  };
  const kp = await keyringsPublicWithFingerprints(mergedVault.keyrings);
  const res = await persistMergedVault(mergedVault, password, kp);
  if (!res.ok) return res;
  await mergeHdMapAfterImport(keyringId, mnemonic);
  broadcastAccounts(broadcastEvent, mergedVault.accounts);
  return { ok: true, data: { accounts: mergedVault.accounts, keyrings: kp } };
}

export async function handleImportWallet(
  mnemonic: string,
  password?: string,
): Promise<MessageResponse> {
  if (await isVaultInitialized()) {
    return handleAddKeyringImport(mnemonic, password);
  }
  const keyringId = crypto.randomUUID();
  const acc = wallet.deriveAccount(mnemonic, 0, keyringId);
  const hd = buildHdKeyring(mnemonic, keyringId, "Main Wallet", [acc]);
  const vault: VaultData = {
    keyrings: [hd],
    accounts: [acc],
    activeAccountAddress: acc.address,
  };
  const res = await persistFreshWallet(vault, password, "import");
  if (!res.ok) return res;
  broadcastEvent("accountsChanged", [acc.address]);
  return { ok: true, data: { accounts: vault.accounts } };
}

export async function handleImportPrivateKey(
  privateKey: Hex,
  password?: string,
): Promise<MessageResponse> {
  const address = wallet.importFromPrivateKey(privateKey);
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();

  const importedAcc = (idx: number): SerializedAccount => ({
    name: `Imported Account ${idx + 1}`,
    address,
    path: "imported",
    index: idx,
    keyringId: IMPORTED_KEYRING_ID,
  });

  if (!meta) {
    const acc = importedAcc(0);
    const vault: VaultData = {
      keyrings: [importedKeyringMeta()],
      accounts: [acc],
      activeAccountAddress: acc.address,
      importedKeys: { [address.toLowerCase()]: privateKey },
    };
    const res = await persistFreshWallet(vault, password, "importKey");
    if (!res.ok) return res;
    broadcastEvent("accountsChanged", [acc.address]);
    return { ok: true, data: { accounts: [acc] } };
  }

  if (mode === "keychain") {
    const auth = await keychain.authenticateUser("Import key to secure storage");
    if (!auth.ok) {
      return { ok: false, error: auth.error ?? "Authentication failed or cancelled" };
    }
    const storeRes = await keychain.storeImportedKey(address, privateKey);
    if (!storeRes.ok) {
      return { ok: false, error: storeRes.error ?? "Keychain store failed" };
    }
    const idx = nextImportIndex(meta.accounts);
    const acc = importedAcc(idx);
    const kp = ensureImportedKeyringPublic(meta.keyrings);
    const mergedAccounts = [...meta.accounts, acc];
    await saveAccountsMeta(mergedAccounts, meta.activeAccountAddress, kp);
    broadcastAccounts(broadcastEvent, mergedAccounts);
    return { ok: true, data: { accounts: mergedAccounts } };
  }

  if (!password) return { ok: false, error: "Password required" };
  let data: VaultData;
  try {
    data = await loadVaultForMerge(password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const idx = nextImportIndex(data.accounts);
  const acc = importedAcc(idx);
  const mergedImported = {
    ...(data.importedKeys ?? {}),
    [address.toLowerCase()]: privateKey,
  };
  let keyrings: KeyringStored[] = [...data.keyrings];
  if (!keyrings.some((k) => k.type === "imported")) {
    keyrings = [...keyrings, importedKeyringMeta()];
  }
  const mergedVault: VaultData = {
    keyrings,
    accounts: [...data.accounts, acc],
    activeAccountAddress: data.activeAccountAddress,
    importedKeys: mergedImported,
  };
  const kp = await keyringsPublicWithFingerprints(keyrings);
  const res = await persistMergedVault(mergedVault, password, kp);
  if (!res.ok) return res;
  broadcastAccounts(broadcastEvent, mergedVault.accounts);
  return { ok: true, data: { accounts: mergedVault.accounts } };
}

export async function handleRenameKeyring(
  keyringId: string,
  label: string,
): Promise<MessageResponse> {
  const m = await requireMeta("No wallet");
  if (!m.ok) return m.response;
  const meta = m.meta;
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Label required" };
  const keyringsPub = meta.keyrings.map((k) => (k.id === keyringId ? { ...k, label: trimmed } : k));
  await saveAccountsMeta(meta.accounts, meta.activeAccountAddress, keyringsPub);
  return { ok: true };
}

export async function handleDeleteKeyring(
  keyringId: string,
  password: string | undefined,
): Promise<MessageResponse> {
  const m = await requireMeta("No wallet");
  if (!m.ok) return m.response;
  const meta = m.meta;
  const hdCount = meta.keyrings.filter((k) => k.type === "hd").length;
  if (keyringId === IMPORTED_KEYRING_ID) {
    return { ok: false, error: "Remove imported accounts individually from Settings" };
  }
  const hasImportedAccounts = meta.accounts.some((a) => a.path === "imported");
  if (hdCount <= 1 && !hasImportedAccounts) {
    return { ok: false, error: "Cannot delete the last HD keyring" };
  }
  const mode = await getStorageMode();
  const remainingKeyringsPub = meta.keyrings.filter((k) => k.id !== keyringId);
  const remainingAccounts = meta.accounts.filter((a) => a.keyringId !== keyringId);
  if (remainingAccounts.length === 0) {
    return { ok: false, error: "Invalid state" };
  }
  let active = meta.activeAccountAddress;
  if (!remainingAccounts.some((a) => a.address === active)) {
    const first = remainingAccounts[0];
    if (!first) return { ok: false, error: "Invalid state" };
    active = first.address;
  }
  const map = (await loadHdDerivedAddressMap()) ?? {};
  delete map[keyringId];
  await saveHdDerivedAddressMap(map);

  if (mode === "keychain") {
    await keychain.deleteMnemonicForKeyring(keyringId);
    await saveAccountsMeta(remainingAccounts, active, remainingKeyringsPub);
    broadcastAccounts(broadcastEvent, remainingAccounts);
    return { ok: true };
  }

  if (!password) return { ok: false, error: "Password required" };
  let data: VaultData;
  try {
    data = await loadVaultForMerge(password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const remainingKeyrings = data.keyrings.filter((k) => k.id !== keyringId);
  const remainingFromVault = data.accounts.filter((a) => a.keyringId !== keyringId);
  if (remainingFromVault.length === 0) {
    return { ok: false, error: "Invalid state" };
  }
  let activeV = data.activeAccountAddress;
  if (!remainingFromVault.some((a) => a.address === activeV)) {
    const first = remainingFromVault[0];
    if (!first) return { ok: false, error: "Invalid state" };
    activeV = first.address;
  }
  const nextVault: VaultData = {
    keyrings: remainingKeyrings,
    accounts: remainingFromVault,
    activeAccountAddress: activeV,
    ...(data.importedKeys ? { importedKeys: data.importedKeys } : {}),
  };
  const kp = await keyringsPublicWithFingerprints(nextVault.keyrings);
  const res = await persistMergedVault(nextVault, password, kp);
  if (!res.ok) return res;
  broadcastAccounts(broadcastEvent, remainingFromVault);
  return { ok: true };
}
