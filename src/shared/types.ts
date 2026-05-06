import type { Address, Hex } from "viem";

import type { IMPORTED_KEYRING_ID } from "./keyring-constants";

export interface SerializedAccount {
  name: string;
  address: Address;
  path: string;
  /** BIP-44 address index within this account's keyring (HD); 0 for imports. */
  index: number;
  /** Parent keyring: HD keyring id, or `imported` for private-key accounts. */
  keyringId: string;
  /** HD soft-remove: kept for chain-discovery tombstones; never set on imported accounts. */
  hidden?: boolean;
}

/** Public keyring row for UI (stored in plaintext AccountsMeta). */
export interface KeyringPublic {
  id: string;
  label: string;
  type: "hd" | "imported";
  /** SHA-256 hex of normalized mnemonic — for duplicate detection (HD only). */
  mnemonicFingerprint?: string;
}

export type HdKeyringStored = {
  type: "hd";
  id: string;
  label: string;
  mnemonic: string;
  nextDerivationIndex: number;
  createdAt: number;
};

export type ImportedKeyringStored = {
  type: "imported";
  id: typeof IMPORTED_KEYRING_ID; // always IMPORTED_KEYRING_ID
  label: string;
  createdAt: number;
};

export type KeyringStored = HdKeyringStored | ImportedKeyringStored;

export interface VaultData {
  keyrings: KeyringStored[];
  accounts: SerializedAccount[];
  activeAccountAddress: Address;
  importedKeys?: Record<string, string>;
}

export interface EncryptedVault {
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface ChainMeta {
  id: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  testnet?: boolean;
  /** Preferred public RPCs (longest-first from chainlist at build time, then viem defaults). */
  rpcUrls?: string[];
  rpcUrl?: string;
  blockExplorerUrl?: string;
  alchemySlug?: string;
  trustSlug?: string;
  disperseAddress?: Address;
}

export interface MultiSendEntry {
  to: Address;
  /** undefined = native token */
  tokenAddress?: Address;
  amount: string;
  decimals: number;
  symbol: string;
  tokenName: string;
}

export interface WalletState {
  isInitialized: boolean;
  storageMode: "keychain" | "vault";
  accounts: SerializedAccount[];
  keyrings: KeyringPublic[];
  activeAccountAddress: Address;
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
  logoUrl?: string;
  source?: "manual" | "activity" | "scan";
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

export interface PermitData {
  tokenAddress: Address;
  spender: Address;
  value: string;
  /** Unix seconds; 0 = use default (10 min from now). */
  deadline?: number;
  /** Token name for the EIP-712 domain. */
  tokenName: string;
  /** Token nonce for the permit signer. */
  nonce: string;
}

export interface PendingApproval {
  id: string;
  method: string;
  params: unknown[];
  origin: string;
  /** Page favicon URL from the tab (connection requests). */
  faviconUrl?: string;
  timestamp: number;
  chainId: number;
  /** When set, executeApproval signs the EIP-712 permit and sends
   *  token.permit() on-chain instead of using the normal tx flow. */
  permitData?: PermitData;
  /** Pre-filled enrichment so the Approve UI can show transfers
   *  without waiting for on-chain simulation. */
  prefilled?: {
    decoded?: DecodedCall | null;
    transfers?: TokenTransfer[] | null;
  };
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

export interface TokenMovement {
  token: string;
  symbol: string;
  amount: string;
  decimals: number;
  dir: "in" | "out";
  /** Counterparty address for ERC-20 Transfer (not the token contract). */
  peer?: string;
}

export interface DecodedEvent {
  name: string;
  args: DecodedArg[];
  contract: string;
}

export interface ActivityItem {
  hash: string;
  from: string;
  to: string;
  value: string;
  ts: number;
  error: boolean;
  method: string;
  fn: string;
  block: number;
  transfers: TokenMovement[];
  decoded: DecodedCall | null;
  events: DecodedEvent[];
}

export interface StoredToken {
  address: string;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  source: "manual" | "activity" | "scan";
  hidden?: boolean;
  addedAt: number;
  /** Raw `balanceOf` result cached from the last successful fetch. */
  lastBalance?: string;
}

export interface AddressBookEntry {
  address: Address;
  name: string;
  addedAt: number;
}

export interface RecentAddress {
  address: Address;
  lastUsedAt: number;
  useCount: number;
}

export interface ApprovalData {
  approval: PendingApproval;
  account: SerializedAccount;
  queueSize?: number;
  storageMode?: "keychain" | "vault";
  gasPresets?: GasPresets | null;
  decoded?: DecodedCall | null;
  transfers?: TokenTransfer[] | null;
  nativeUsdPrice?: number | null;
  decodedVia?: string | null;
  simulatedVia?: string | null;
  hasEtherscanKey?: boolean;
  hasRpcProviderKey?: boolean;
  /** Set when gas estimation failed — RPC / viem revert reason for the Approve screen. */
  gasEstimateError?: string | null;
}

export interface ApprovalEnrichment {
  gasPresets: GasPresets | null;
  gasEstimateError?: string | null;
  decoded?: DecodedCall | null;
  transfers?: TokenTransfer[] | null;
  nativeUsdPrice?: number | null;
  decodedVia?: string | null;
  simulatedVia?: string | null;
  hasEtherscanKey?: boolean;
  hasRpcProviderKey?: boolean;
}
