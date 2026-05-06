import { type Address, type Hex, zeroAddress } from "viem";
import { getBalance, readContract } from "viem/actions";
import { encodeFunctionData, formatEther, formatUnits, numberToHex, parseUnits } from "viem/utils";
import { erc20Abi, feedFaceDisperseAbi } from "../../shared/abis";
import { formatProviderError } from "../../shared/format";
import { IMPORTED_KEYRING_ID } from "../../shared/keyring-constants";
import type { MessageResponse } from "../../shared/messages";
import { mnemonicFingerprint } from "../../shared/mnemonic-fingerprint";
import type {
  DecodedCall,
  HdKeyringStored,
  ImportedKeyringStored,
  KeyringPublic,
  KeyringStored,
  MultiSendEntry,
  SerializedAccount,
  TokenTransfer,
  VaultData,
  WalletState,
} from "../../shared/types";
import { getActiveAccount, visibleAccounts } from "../account-utils";
import { clearAllPending } from "../approval";
import { broadcastEvent } from "../broadcast";
import { runChainDiscovery } from "../chain-discovery";
import { clearConnectedOrigins } from "../connected-origins";
import { fetchNativePrice } from "../etherscan";
import {
  clearHdDerivedAddresses,
  loadHdDerivedAddressMap,
  resolveHdAddressMap,
  saveHdDerivedAddressMap,
} from "../hd-addresses";
import * as keychain from "../keychain";
import { bgLog } from "../log";
import {
  getActiveNetworkId,
  getNetworkConfig,
  getPublicClient,
  setActiveNetworkId,
} from "../networks";
import { fetchNativePriceCoinGecko, fetchTokenPrice } from "../prices";
import { handleRpc } from "../rpc-handler";
import { fetchTokenMeta } from "../token-meta";
import { updateTokenBalances } from "../token-store";
import {
  clearVault,
  decryptVault,
  getStorageMode,
  isVaultInitialized,
  loadAccountsMeta,
  type StorageMode,
  saveAccountsMeta,
} from "../vault";
import * as wallet from "../wallet";
import {
  buildHdKeyring,
  ensureImportedKeyringPublic,
  importedKeyringMeta,
  insertHdKeyringPublic,
  keyringsPublicWithFingerprints,
  mergeHdMapAfterImport,
  nextHdIndexForKeyring,
  nextImportIndex,
  persistFreshWallet,
  persistKeychainFull,
  persistVaultModeFull,
  retrieveHdMnemonicForKeyring,
} from "../wallet-internal";

export { retrieveHdMnemonicForKeyring };

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

async function loadVaultForMerge(password: string): Promise<VaultData> {
  const meta = await loadAccountsMeta();
  const data = await decryptVault(password);
  return meta ? mergePlaintextMetaIntoVaultData(data, meta) : data;
}

async function persistMergedVault(
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
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };
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
    broadcastEvent(
      "accountsChanged",
      mergedAccounts.map((a) => a.address),
    );
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
  const hds = data.keyrings.filter((k): k is HdKeyringStored => k.type === "hd");
  const imp = data.keyrings.filter((k): k is ImportedKeyringStored => k.type === "imported");
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
  broadcastEvent(
    "accountsChanged",
    mergedVault.accounts.map((a) => a.address),
  );
  return { ok: true, data: { mnemonic, accounts: mergedVault.accounts, keyrings: kp } };
}

export async function handleAddKeyringImport(
  mnemonic: string,
  password: string | undefined,
): Promise<MessageResponse> {
  if (!(await isVaultInitialized())) {
    return handleImportWallet(mnemonic, password);
  }
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };
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
    broadcastEvent(
      "accountsChanged",
      mergedAccounts.map((a) => a.address),
    );
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
  const hds = data.keyrings.filter((k): k is HdKeyringStored => k.type === "hd");
  const imp = data.keyrings.filter((k): k is ImportedKeyringStored => k.type === "imported");
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
  broadcastEvent(
    "accountsChanged",
    mergedVault.accounts.map((a) => a.address),
  );
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
    const idx = 0;
    const acc = importedAcc(idx);
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
    broadcastEvent(
      "accountsChanged",
      mergedAccounts.map((a) => a.address),
    );
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
  broadcastEvent(
    "accountsChanged",
    mergedVault.accounts.map((a) => a.address),
  );
  return { ok: true, data: { accounts: mergedVault.accounts } };
}

export async function handleRenameKeyring(
  keyringId: string,
  label: string,
): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "No wallet" };
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
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "No wallet" };
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
  const m = (await loadHdDerivedAddressMap()) ?? {};
  delete m[keyringId];
  await saveHdDerivedAddressMap(m);

  if (mode === "keychain") {
    await keychain.deleteMnemonicForKeyring(keyringId);
    await saveAccountsMeta(remainingAccounts, active, remainingKeyringsPub);
    broadcastEvent(
      "accountsChanged",
      remainingAccounts.map((a) => a.address),
    );
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
  broadcastEvent(
    "accountsChanged",
    remainingFromVault.map((a) => a.address),
  );
  return { ok: true };
}

export async function handleRenameAccount(
  address: Address,
  name: string,
): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "No wallet" };
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
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "No wallet" };
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
      broadcastEvent(
        "accountsChanged",
        visibleAccounts(remainingAccounts).map((a) => a.address),
      );
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
    broadcastEvent(
      "accountsChanged",
      visibleAccounts(nextAccounts).map((a) => a.address),
    );
    return { ok: true };
  }

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
    broadcastEvent(
      "accountsChanged",
      visibleAccounts(nextAccountsHd).map((a) => a.address),
    );
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
  broadcastEvent(
    "accountsChanged",
    visibleAccounts(nextVaultAccounts).map((a) => a.address),
  );
  return { ok: true };
}

async function getWalletState(): Promise<WalletState> {
  const meta = await loadAccountsMeta();
  const mode = await getStorageMode();
  if (meta && meta.accounts.length > 0) {
    const visible = visibleAccounts(meta.accounts);
    const row = meta.accounts.find(
      (a) => a.address.toLowerCase() === meta.activeAccountAddress.toLowerCase(),
    );
    const activePointsToHiddenOrMissing = !row || row.hidden === true;
    const firstVis = visible[0];
    if (firstVis && activePointsToHiddenOrMissing) {
      const fixed = firstVis.address;
      await saveAccountsMeta(meta.accounts, fixed, meta.keyrings);
      broadcastEvent(
        "accountsChanged",
        visible.map((a) => a.address),
      );
      return {
        isInitialized: await isVaultInitialized(),
        storageMode: mode,
        accounts: visible,
        keyrings: meta.keyrings,
        activeAccountAddress: fixed,
        activeNetworkId: await getActiveNetworkId(),
      };
    }
  }
  return {
    isInitialized: await isVaultInitialized(),
    storageMode: mode,
    accounts: visibleAccounts(meta?.accounts ?? []),
    keyrings: meta?.keyrings ?? [],
    activeAccountAddress: meta?.activeAccountAddress ?? zeroAddress,
    activeNetworkId: await getActiveNetworkId(),
  };
}

export async function handleGetState(): Promise<MessageResponse> {
  return { ok: true, data: await getWalletState() };
}

export async function handleGetAccounts(): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  return { ok: true, data: { accounts: visibleAccounts(meta?.accounts ?? []) } };
}

export async function handleDeriveAccount(
  keyringId: string,
  password?: string,
): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };
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
    broadcastEvent(
      "accountsChanged",
      nextAccounts.map((a) => a.address),
    );
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
  broadcastEvent(
    "accountsChanged",
    nextAccounts.map((a) => a.address),
  );
  return { ok: true, data: { account } };
}

export async function handleAddAccount(password?: string): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };
  const active = getActiveAccount(meta);
  if (!active || active.path === "imported") {
    return {
      ok: false,
      error: "Select an HD account, or use Settings → Derive account for a specific keyring",
    };
  }
  return handleDeriveAccount(active.keyringId, password);
}

export async function handleEnsureChainDiscovery(chainId: number): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  if (!meta?.accounts.length) return { ok: false, error: "Wallet not initialized" };

  const visForDiscovery = visibleAccounts(meta.accounts);
  if (visForDiscovery.length > 0 && visForDiscovery.every((a) => a.path === "imported")) {
    return {
      ok: true,
      data: {
        activeAccountIndices: visForDiscovery.map((_, i) => i),
        scannedAt: Date.now(),
      },
    };
  }

  const hdMap = await resolveHdAddressMap();

  try {
    bgLog(`[chain-discovery] started with ${chainId}`);
    const data = await runChainDiscovery(chainId, meta, hdMap);
    return { ok: true, data };
  } catch (e) {
    const msg = formatProviderError(e);
    bgLog("[chain-discovery]", chainId, msg);
    return { ok: false, error: msg || "Chain scan failed" };
  }
}

export async function handleGetBalance(
  address: Address,
  chainId: number,
): Promise<MessageResponse> {
  const client = getPublicClient(chainId);
  const cfg = getNetworkConfig(chainId);
  const isTestnet = cfg?.testnet === true;
  try {
    const [balance, nativeUsdPrice] = await Promise.all([
      getBalance(client, { address }),
      isTestnet
        ? Promise.resolve(0)
        : fetchNativePrice(chainId).then((p) => p ?? fetchNativePriceCoinGecko(chainId)),
    ]);
    return { ok: true, data: { balance: formatEther(balance), nativeUsdPrice } };
  } catch (e) {
    const msg = formatProviderError(e);
    bgLog("[get-balance]", chainId, address, msg);
    return { ok: false, error: msg || "Could not load balance" };
  }
}

export async function handleSwitchNetwork(chainId: number): Promise<MessageResponse> {
  await setActiveNetworkId(chainId);
  broadcastEvent("chainChanged", numberToHex(chainId));
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
    broadcastEvent(
      "accountsChanged",
      visibleAccounts(meta.accounts).map((a) => a.address),
    );
  }
  return { ok: true };
}

export async function handleExportPrivateKey(
  address: Address,
  password?: string,
): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };
  const acc = meta.accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
  if (!acc || acc.hidden) return { ok: false, error: "Account not found" };
  if (acc.path === "imported") {
    const pk =
      (await retrieveImportedKey(mode, acc.address, password, "Export private key")) ?? null;
    if (!pk) return { ok: false, error: "Could not export key" };
    return { ok: true, data: { privateKey: pk } };
  }
  const mnemonic = await retrieveHdMnemonicForKeyring(
    mode,
    acc.keyringId,
    password,
    "Export private key",
  );
  const privateKey = wallet.getPrivateKeyForAccount(mnemonic, acc.index);
  return { ok: true, data: { privateKey } };
}

export async function handleExportMnemonic(
  keyringId: string | undefined,
  password?: string,
): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };
  const active = getActiveAccount(meta);
  const kid =
    keyringId ??
    (active?.path !== "imported"
      ? active?.keyringId
      : meta.keyrings.find((k) => k.type === "hd")?.id);
  if (!kid || kid === IMPORTED_KEYRING_ID) {
    return { ok: false, error: "No HD keyring to export" };
  }
  const mnemonic = await retrieveHdMnemonicForKeyring(
    mode,
    kid,
    password,
    "Export recovery phrase",
  );
  return { ok: true, data: { mnemonic } };
}

export async function handleResetWallet(password?: string): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "No wallet" };

  if (mode === "keychain") {
    const auth = await keychain.authenticateUser("Reset wallet");
    if (!auth.ok) {
      return {
        ok: false,
        error: auth.error ?? "Authentication failed or cancelled",
      };
    }
  } else {
    if (!password) return { ok: false, error: "Password required" };
    try {
      await decryptVault(password);
    } catch {
      return { ok: false, error: "Wrong password" };
    }
  }
  clearAllPending();
  for (const k of meta.keyrings) {
    if (k.type === "hd") await keychain.deleteMnemonicForKeyring(k.id);
  }
  await keychain.deleteAllImportedKeys(
    meta.accounts.filter((a) => a.path === "imported").map((a) => a.address),
  );
  await clearVault();
  await clearHdDerivedAddresses();
  await clearConnectedOrigins();
  broadcastEvent("accountsChanged", []);
  broadcastEvent("disconnect", { code: 4900, message: "Wallet reset" });
  return { ok: true };
}

export async function handleGetTokenBalances(tokens: Address[]): Promise<MessageResponse> {
  const chainId = await getActiveNetworkId();
  const client = getPublicClient(chainId);
  const meta = await loadAccountsMeta();
  const account = meta ? getActiveAccount(meta) : undefined;
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const results = await Promise.all(
    tokens.map((token) =>
      readContract(client, {
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      }).catch(() => 0n),
    ),
  );

  const balances: Record<string, string> = {};
  for (const [i, token] of tokens.entries()) {
    balances[token] = String(results[i]);
  }

  updateTokenBalances(chainId, account.address, balances).catch(() => {});

  return { ok: true, data: { balances } };
}

export async function handleGetTokenPrice(
  address: Address,
  chainId: number,
): Promise<MessageResponse> {
  const cfg = getNetworkConfig(chainId);
  if (cfg?.testnet) return { ok: true, data: { price: null } };
  const price = await fetchTokenPrice(chainId, address);
  return { ok: true, data: { price } };
}

export async function handleGetTokenInfo(
  address: Address,
  chainId: number,
): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  const account = meta ? getActiveAccount(meta) : undefined;
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const tokenMeta = await fetchTokenMeta(chainId, address);
  if (tokenMeta.symbol === "???") {
    return { ok: false, error: "Could not read token contract" };
  }

  const client = getPublicClient(chainId);
  let balance = "0";
  try {
    const raw = await readContract(client, {
      address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    balance = formatUnits(raw, tokenMeta.decimals);
  } catch {
    /* balance read failed — return 0 */
  }

  return {
    ok: true,
    data: {
      name: tokenMeta.name,
      symbol: tokenMeta.symbol,
      decimals: tokenMeta.decimals,
      balance,
    },
  };
}

export async function handleSendToken(
  tokenAddress: Address,
  to: Address,
  amount: string,
  decimals: number,
): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  const account = meta ? getActiveAccount(meta) : undefined;
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, parseUnits(amount, decimals)],
  });

  const result = await handleRpc(
    "eth_sendTransaction",
    [{ from: account.address, to: tokenAddress, data }],
    { origin: "lion-wallet://popup" },
  );
  return { ok: true, data: result };
}

function buildTransfers(entries: MultiSendEntry[]): TokenTransfer[] {
  return entries.map((e) => ({
    direction: "out" as const,
    symbol: e.symbol,
    name: e.tokenName,
    amount: e.amount,
    color: "#627EEA",
    tokenAddress: e.tokenAddress,
  }));
}

export async function handleMultiSend(entries: MultiSendEntry[]): Promise<MessageResponse> {
  if (entries.length === 0) return { ok: false, error: "No entries provided" };

  const meta = await loadAccountsMeta();
  const account = meta ? getActiveAccount(meta) : undefined;
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const chainId = await getActiveNetworkId();
  const network = getNetworkConfig(chainId);

  const nativeEntries = entries.filter((e) => !e.tokenAddress);
  const erc20ByToken = new Map<Address, MultiSendEntry[]>();
  for (const e of entries) {
    if (!e.tokenAddress) continue;
    const key = e.tokenAddress.toLowerCase() as Address;
    const group = erc20ByToken.get(key) ?? [];
    group.push(e);
    erc20ByToken.set(key, group);
  }

  const disperseAddr = network?.disperseAddress as Address | undefined;
  let queued = 0;

  if (!disperseAddr) {
    for (const e of nativeEntries) {
      await handleRpc(
        "eth_sendTransaction",
        [
          {
            from: account.address,
            to: e.to,
            value: numberToHex(parseUnits(e.amount, e.decimals)),
          },
        ],
        { origin: "lion-wallet://popup" },
      );
      queued++;
    }
    for (const [tokenAddr, group] of erc20ByToken) {
      for (const e of group) {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [e.to, parseUnits(e.amount, e.decimals)],
        });
        const decoded: DecodedCall = {
          functionName: "transfer",
          args: [
            {
              name: "to",
              type: "address",
              value: `${e.to.slice(0, 6)}…${e.to.slice(-4)}`,
            },
            { name: "amount", type: "uint256", value: `${e.amount} ${e.symbol}` },
          ],
        };
        await handleRpc("eth_sendTransaction", [{ from: account.address, to: tokenAddr, data }], {
          origin: "lion-wallet://popup",
          extras: { prefilled: { decoded, transfers: buildTransfers([e]) } },
        });
        queued++;
      }
    }
    return { ok: true, data: { queued } };
  }

  const client = getPublicClient(chainId);

  const ethTransfers = nativeEntries.map((e) => ({
    to: e.to,
    amount: parseUnits(e.amount, e.decimals),
  }));
  const totalEthValue = ethTransfers.reduce((sum, t) => sum + t.amount, 0n);

  const tokenTransfers: { token: Address; to: Address; amount: bigint }[] = [];
  for (const e of entries) {
    if (!e.tokenAddress) continue;
    tokenTransfers.push({
      token: e.tokenAddress,
      to: e.to,
      amount: parseUnits(e.amount, e.decimals),
    });
  }

  for (const [tokenAddr, group] of erc20ByToken) {
    const first = group[0];
    if (!first) continue;
    const totalNeeded = group.reduce((sum, e) => sum + parseUnits(e.amount, e.decimals), 0n);

    let currentAllowance = 0n;
    try {
      currentAllowance = (await readContract(client, {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account.address, disperseAddr],
      })) as bigint;
    } catch {
      /* assume 0 */
    }

    if (currentAllowance < totalNeeded) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [disperseAddr, totalNeeded],
      });
      const approveDecoded: DecodedCall = {
        functionName: "approve",
        args: [
          { name: "spender", type: "address", value: "FeedFace Disperse" },
          {
            name: "amount",
            type: "uint256",
            value: `${formatUnits(totalNeeded, first.decimals)} ${first.symbol}`,
          },
        ],
      };
      await handleRpc(
        "eth_sendTransaction",
        [{ from: account.address, to: tokenAddr, data: approveData }],
        { origin: "lion-wallet://popup", extras: { prefilled: { decoded: approveDecoded } } },
      );
      queued++;
    }
  }

  const data = encodeFunctionData({
    abi: feedFaceDisperseAbi,
    functionName: "disperse",
    args: [ethTransfers, tokenTransfers, []],
  });
  const decoded: DecodedCall = {
    contractName: "FeedFaceDisperse",
    functionName: "disperse",
    args: [
      {
        name: "ethTransfers",
        type: "tuple[]",
        value: `${ethTransfers.length} recipient${ethTransfers.length === 1 ? "" : "s"}`,
      },
      {
        name: "tokenTransfers",
        type: "tuple[]",
        value: `${tokenTransfers.length} transfer${tokenTransfers.length === 1 ? "" : "s"}`,
      },
      { name: "permits", type: "tuple[]", value: "none" },
    ],
  };

  await handleRpc(
    "eth_sendTransaction",
    [
      {
        from: account.address,
        to: disperseAddr,
        ...(totalEthValue > 0n ? { value: numberToHex(totalEthValue) } : {}),
        data,
      },
    ],
    {
      origin: "lion-wallet://popup",
      extras: { prefilled: { decoded, transfers: buildTransfers(entries) } },
    },
  );
  queued++;

  return { ok: true, data: { queued } };
}
