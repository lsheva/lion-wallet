import type { Address, Hex } from "viem";
import { formatEther, numberToHex } from "viem/utils";
import { getBalance } from "viem/actions";
import type { MessageResponse } from "../../shared/messages";
import type { SerializedAccount, WalletState } from "../../shared/types";
import { broadcastEvent } from "../broadcast";
import { fetchNativePrice } from "../etherscan";
import * as keychain from "../keychain";
import { bgLog } from "../log";
import {
  getActiveNetworkId,
  getNetworkConfig,
  getPublicClient,
  setActiveNetworkId,
} from "../networks";
import {
  clearVault,
  decryptVault,
  encryptVault,
  getStorageMode,
  isVaultInitialized,
  loadAccountsMeta,
  type StorageMode,
  saveAccountsMeta,
  setStorageMode,
} from "../vault";
import * as wallet from "../wallet";

export async function retrieveMnemonic(
  mode: StorageMode,
  password?: string,
  reason?: string,
): Promise<string> {
  if (mode === "keychain") {
    const mnemonic = await keychain.retrieveMnemonic(reason);
    if (!mnemonic) throw new Error("Authentication failed or cancelled");
    return mnemonic;
  }
  if (!password) throw new Error("Password required");
  const data = await decryptVault(password);
  return data.mnemonic;
}

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

interface PersistOpts {
  mnemonic: string;
  accounts: SerializedAccount[];
  password?: string;
  importedKeys?: Record<string, string>;
  label: string;
}

async function persistWalletData({
  mnemonic,
  accounts,
  password,
  importedKeys,
  label,
}: PersistOpts): Promise<MessageResponse> {
  if (!password) {
    const probe = await keychain.isKeychainAvailable();
    bgLog(`[${label}] probe:`, JSON.stringify(probe));
    if (!probe.available) {
      return {
        ok: false,
        error: `Keychain not available: ${probe.error ?? "probe returned false"}`,
      };
    }

    const mnemonicRes = await keychain.storeMnemonic(mnemonic);
    bgLog(`[${label}] storeMnemonic:`, JSON.stringify(mnemonicRes));
    if (!mnemonicRes.ok) {
      return { ok: false, error: `Keychain store failed: ${mnemonicRes.error}` };
    }

    if (importedKeys) {
      for (const [addr, pk] of Object.entries(importedKeys)) {
        const keyRes = await keychain.storeImportedKey(addr as Address, pk as `0x${string}`);
        bgLog(`[${label}] storeKey(${addr}):`, JSON.stringify(keyRes));
        if (!keyRes.ok) {
          return { ok: false, error: `Keychain store failed: key: ${keyRes.error}` };
        }
      }
    }

    await setStorageMode("keychain");
  } else {
    await setStorageMode("vault");
    await encryptVault(
      { mnemonic, accounts, activeAccountIndex: 0, ...(importedKeys ? { importedKeys } : {}) },
      password,
    );
  }

  await saveAccountsMeta(accounts, 0);
  broadcastEvent(
    "accountsChanged",
    accounts.map((a) => a.address),
  );
  return { ok: true };
}

async function getWalletState(): Promise<WalletState> {
  const meta = await loadAccountsMeta();
  const mode = await getStorageMode();
  return {
    isInitialized: await isVaultInitialized(),
    storageMode: mode,
    accounts: meta?.accounts ?? [],
    activeAccountIndex: meta?.activeAccountIndex ?? 0,
    activeNetworkId: await getActiveNetworkId(),
  };
}

export async function handleCreateWallet(password?: string): Promise<MessageResponse> {
  const mnemonic = wallet.createMnemonic();
  const account = wallet.deriveAccount(mnemonic, 0);
  const accounts = [account];
  const res = await persistWalletData({ mnemonic, accounts, password, label: "create" });
  if (!res.ok) return res;
  return { ok: true, data: { mnemonic, accounts } };
}

export async function handleImportWallet(
  mnemonic: string,
  password?: string,
): Promise<MessageResponse> {
  const account = wallet.deriveAccount(mnemonic, 0);
  const accounts = [account];
  const res = await persistWalletData({ mnemonic, accounts, password, label: "import" });
  if (!res.ok) return res;
  return { ok: true, data: { accounts } };
}

export async function handleImportPrivateKey(
  privateKey: Hex,
  password?: string,
): Promise<MessageResponse> {
  const address = wallet.importFromPrivateKey(privateKey);
  const mnemonic = wallet.createMnemonic();
  const imported: SerializedAccount = {
    name: "Imported Account",
    address,
    path: "imported",
    index: 0,
  };
  const accounts = [imported];
  const res = await persistWalletData({
    mnemonic,
    accounts,
    password,
    importedKeys: { [address.toLowerCase()]: privateKey },
    label: "importKey",
  });
  if (!res.ok) return res;
  return { ok: true, data: { accounts } };
}

export async function handleGetState(): Promise<MessageResponse> {
  return { ok: true, data: await getWalletState() };
}

export async function handleGetAccounts(): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  return { ok: true, data: { accounts: meta?.accounts ?? [] } };
}

export async function handleAddAccount(password?: string): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };

  const mnemonic = await retrieveMnemonic(mode, password, "Derive a new account");
  const nextIndex = meta.accounts.length;
  const account = wallet.deriveAccount(mnemonic, nextIndex);
  const updatedAccounts = [...meta.accounts, account];

  await saveAccountsMeta(updatedAccounts, meta.activeAccountIndex);

  if (mode === "vault") {
    if (!password) return { ok: false, error: "Password required to persist account" };
    await encryptVault(
      { mnemonic, accounts: updatedAccounts, activeAccountIndex: meta.activeAccountIndex },
      password,
    );
  }

  broadcastEvent(
    "accountsChanged",
    updatedAccounts.map((a) => a.address),
  );
  return { ok: true, data: { account } };
}

export async function handleGetBalance(
  address: Address,
  chainId: number,
): Promise<MessageResponse> {
  const client = getPublicClient(chainId);
  const cfg = getNetworkConfig(chainId);
  const isTestnet = cfg?.testnet === true;
  const [balance, nativeUsdPrice] = await Promise.all([
    getBalance(client, { address }),
    isTestnet ? Promise.resolve(0) : fetchNativePrice(chainId),
  ]);
  return { ok: true, data: { balance: formatEther(balance), nativeUsdPrice } };
}

export async function handleSwitchNetwork(chainId: number): Promise<MessageResponse> {
  await setActiveNetworkId(chainId);
  broadcastEvent("chainChanged", numberToHex(chainId));
  return { ok: true };
}

export async function handleSwitchAccount(accountIndex: number): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  if (meta) {
    await saveAccountsMeta(meta.accounts, accountIndex);
    broadcastEvent(
      "accountsChanged",
      meta.accounts.map((a) => a.address),
    );
  }
  return { ok: true };
}

export async function handleExportPrivateKey(
  accountIndex: number,
  password?: string,
): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const mnemonic = await retrieveMnemonic(mode, password, "Export private key");
  const privateKey = wallet.getPrivateKeyForAccount(mnemonic, accountIndex);
  return { ok: true, data: { privateKey } };
}

export async function handleExportMnemonic(password?: string): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const mnemonic = await retrieveMnemonic(mode, password, "Export recovery phrase");
  return { ok: true, data: { mnemonic } };
}

export async function handleResetWallet(): Promise<MessageResponse> {
  const { clearAllPending } = await import("../approval");
  clearAllPending();
  await keychain.deleteMnemonic();
  const meta = await loadAccountsMeta();
  if (meta) {
    await keychain.deleteAllImportedKeys(
      meta.accounts.filter((a) => a.path === "imported").map((a) => a.address),
    );
  }
  await clearVault();
  broadcastEvent("accountsChanged", []);
  broadcastEvent("disconnect", { code: 4900, message: "Wallet reset" });
  return { ok: true };
}
