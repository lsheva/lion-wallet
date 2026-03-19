import {
  generateMnemonic,
  mnemonicToAccount,
  privateKeyToAccount,
  english,
} from "viem/accounts";
import { toHex, type Address, type Hex } from "viem";
import type { SerializedAccount, VaultData } from "../shared/types";

let unlockedMnemonic: string | null = null;
let unlockedAccounts: SerializedAccount[] = [];
let activeAccountIdx = 0;
const importedKeys = new Map<string, Hex>();

export function createMnemonic(): string {
  return generateMnemonic(english);
}

export function deriveAccount(
  mnemonic: string,
  index: number,
): SerializedAccount {
  const account = mnemonicToAccount(mnemonic, { addressIndex: index });
  return {
    name: `Account ${index + 1}`,
    address: account.address,
    path: `m/44'/60'/0'/0/${index}`,
    index,
  };
}

export function importFromPrivateKey(privateKey: Hex): Address {
  const account = privateKeyToAccount(privateKey);
  return account.address;
}

export function getPrivateKeyForAccount(
  mnemonic: string,
  index: number,
): Hex {
  const hdAccount = mnemonicToAccount(mnemonic, { addressIndex: index });
  const hdKey = hdAccount.getHdKey();
  if (!hdKey.privateKey) throw new Error("Failed to derive private key");
  return toHex(hdKey.privateKey);
}

export function getSigner(mnemonic: string, index: number) {
  return mnemonicToAccount(mnemonic, { addressIndex: index });
}

export function getSignerFromKey(privateKey: Hex) {
  return privateKeyToAccount(privateKey);
}

export function loadState(data: VaultData): void {
  unlockedMnemonic = data.mnemonic;
  unlockedAccounts = data.accounts;
  activeAccountIdx = data.activeAccountIndex;
}

export function storeImportedKey(address: Address, privateKey: Hex): void {
  importedKeys.set(address.toLowerCase(), privateKey);
}

export function getImportedKey(address: Address): Hex | undefined {
  return importedKeys.get(address.toLowerCase());
}

export function clearState(): void {
  unlockedMnemonic = null;
  unlockedAccounts = [];
  activeAccountIdx = 0;
  importedKeys.clear();
}

export function isUnlocked(): boolean {
  return unlockedMnemonic !== null;
}

export function getMnemonic(): string | null {
  return unlockedMnemonic;
}

export function getAccounts(): SerializedAccount[] {
  return unlockedAccounts;
}

export function getActiveAccountIndex(): number {
  return activeAccountIdx;
}

export function setActiveAccountIndex(index: number): void {
  activeAccountIdx = index;
}

export function addAccount(): SerializedAccount {
  if (!unlockedMnemonic) throw new Error("Wallet is locked");
  const nextIndex = unlockedAccounts.length;
  const account = deriveAccount(unlockedMnemonic, nextIndex);
  unlockedAccounts = [...unlockedAccounts, account];
  return account;
}

export function buildVaultData(): VaultData {
  if (!unlockedMnemonic) throw new Error("Wallet is locked");
  return {
    mnemonic: unlockedMnemonic,
    accounts: unlockedAccounts,
    activeAccountIndex: activeAccountIdx,
  };
}
