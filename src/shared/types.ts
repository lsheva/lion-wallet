import type { Address } from "viem";

export interface SerializedAccount {
  name: string;
  address: Address;
  path: string;
  index: number;
}

export interface VaultData {
  mnemonic: string;
  accounts: SerializedAccount[];
  activeAccountIndex: number;
}

export interface EncryptedVault {
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface NetworkConfig {
  id: number;
  name: string;
  symbol: string;
  color: string;
  rpcUrl: string;
  blockExplorerUrl?: string;
  testnet?: boolean;
}

export interface WalletState {
  isInitialized: boolean;
  isUnlocked: boolean;
  accounts: SerializedAccount[];
  activeAccountIndex: number;
  activeNetworkId: number;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  address?: Address;
  decimals: number;
  balance: string;
  usdValue?: string;
  color: string;
}
