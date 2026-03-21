import type { Address, Hex } from "viem";
import { english, generateMnemonic, mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { toHex } from "viem/utils";
import type { SerializedAccount } from "../shared/types";

export function createMnemonic(): string {
  return generateMnemonic(english);
}

export function deriveAccount(mnemonic: string, index: number): SerializedAccount {
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

export function getPrivateKeyForAccount(mnemonic: string, index: number): Hex {
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
