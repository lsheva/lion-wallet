import type { Address, Hex } from "viem";

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

export type GasSpeed = "slow" | "normal" | "fast";

export interface GasEstimate {
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  estimatedCostWei: string;
  estimatedCostEth: string;
}

export interface GasPresets {
  slow: GasEstimate;
  normal: GasEstimate;
  fast: GasEstimate;
  baseFeeGwei: string;
}

export interface TransactionParams {
  from?: Address;
  to: Address;
  value?: Hex;
  data?: Hex;
  gas?: Hex;
  gasPrice?: Hex;
  maxFeePerGas?: Hex;
  maxPriorityFeePerGas?: Hex;
  nonce?: Hex;
}

export interface PendingApproval {
  id: string;
  method: string;
  params: unknown[];
  origin: string;
  timestamp: number;
  chainId: number;
}

export interface ApprovalResult {
  txHash?: Hex;
  signature?: Hex;
  error?: string;
}

export interface DecodedArg {
  name: string;
  type: string;
  value: string;
}

export interface DecodedCall {
  contractName?: string;
  functionName: string;
  args: DecodedArg[];
}

export interface TokenTransfer {
  direction: "out" | "in";
  symbol: string;
  name: string;
  amount: string;
  usdValue?: string;
  color: string;
  tokenAddress?: string;
}
