import type { Address, Hex } from "viem";

import { MESSAGE_TIMEOUT_MS } from "./protocol";
import type {
  ActivityItem,
  ApprovalData,
  GasPresets,
  GasSpeed,
  SerializedAccount,
  StoredToken,
  TransactionParams,
  WalletState,
} from "./types";

export type MessageRequest =
  | { type: "CREATE_WALLET"; password?: string }
  | { type: "IMPORT_WALLET"; mnemonic: string; password?: string }
  | { type: "IMPORT_PRIVATE_KEY"; privateKey: Hex; password?: string }
  | { type: "GET_STATE" }
  | { type: "GET_ACCOUNTS" }
  | { type: "ADD_ACCOUNT"; password?: string }
  | { type: "GET_BALANCE"; address: Address; chainId: number }
  | { type: "SWITCH_NETWORK"; chainId: number }
  | { type: "SWITCH_ACCOUNT"; accountIndex: number }
  | { type: "EXPORT_PRIVATE_KEY"; accountIndex: number; password?: string }
  | { type: "EXPORT_MNEMONIC"; password?: string }
  | { type: "RPC_REQUEST"; id: string; method: string; params?: unknown[]; origin: string }
  | { type: "GET_PENDING_APPROVAL" }
  | { type: "APPROVE_REQUEST"; id: string; gasSpeed?: GasSpeed; password?: string }
  | { type: "REJECT_REQUEST"; id: string }
  | { type: "ESTIMATE_GAS"; chainId: number; tx: TransactionParams }
  | { type: "RESET_WALLET"; password?: string }
  | { type: "GET_ETHERSCAN_KEY" }
  | { type: "SET_ETHERSCAN_KEY"; key: string }
  | { type: "GET_RPC_PROVIDER_KEY" }
  | { type: "SET_RPC_PROVIDER_KEY"; key: string }
  | { type: "GET_STORAGE_MODE" }
  | { type: "CHECK_KEYCHAIN_AVAILABLE" }
  | { type: "GET_TOKEN_BALANCES"; tokens: Address[] }
  | { type: "SEND_TOKEN"; tokenAddress: Address; to: Address; amount: string; decimals: number }
  | { type: "GET_ACTIVITY"; address: Address; chainId: number; loadMore?: boolean }
  | { type: "CLEAR_ACTIVITY_CACHE" }
  | { type: "GET_TOKEN_INFO"; address: Address; chainId: number }
  | { type: "GET_TOKEN_IMAGE"; address: Address; chainId: number }
  | { type: "GET_DISCOVERED_TOKENS"; chainId: number; walletAddress: Address }
  | { type: "HIDE_DISCOVERED_TOKEN"; chainId: number; walletAddress: Address; address: Address }
  | { type: "ADD_MANUAL_TOKEN"; address: Address; chainId: number; walletAddress: Address }
  | { type: "SCAN_TOKENS"; chainId: number; address: Address };

/** Untyped base response — used by the background handler's return type. */
export type MessageResponse = { ok: true; data?: unknown } | { ok: false; error: string };

/** Maps each message type to the shape of `data` in its success response. `void` = no data field. */
export interface MessageDataMap {
  CREATE_WALLET: { mnemonic: string; accounts: SerializedAccount[] };
  IMPORT_WALLET: { accounts: SerializedAccount[] };
  IMPORT_PRIVATE_KEY: { accounts: SerializedAccount[] };
  GET_STATE: WalletState;
  GET_ACCOUNTS: { accounts: SerializedAccount[] };
  ADD_ACCOUNT: { account: SerializedAccount };
  GET_BALANCE: { balance: string; nativeUsdPrice: number | null };
  SWITCH_NETWORK: undefined;
  SWITCH_ACCOUNT: undefined;
  EXPORT_PRIVATE_KEY: { privateKey: Hex };
  EXPORT_MNEMONIC: { mnemonic: string };
  RPC_REQUEST: { result: unknown };
  GET_PENDING_APPROVAL: ApprovalData | null;
  APPROVE_REQUEST: { result: string };
  REJECT_REQUEST: undefined;
  ESTIMATE_GAS: GasPresets;
  RESET_WALLET: undefined;
  GET_ETHERSCAN_KEY: { key: string | null };
  SET_ETHERSCAN_KEY: undefined;
  GET_RPC_PROVIDER_KEY: { key: string | null };
  SET_RPC_PROVIDER_KEY: undefined;
  GET_STORAGE_MODE: { storageMode: "keychain" | "vault" };
  CHECK_KEYCHAIN_AVAILABLE: { available: boolean; error?: string };
  GET_TOKEN_BALANCES: { balances: Record<string, string> };
  SEND_TOKEN: undefined;
  GET_ACTIVITY: {
    items: ActivityItem[];
    hasMore: boolean;
    source: "etherscan" | "rpc" | "cache";
  };
  CLEAR_ACTIVITY_CACHE: undefined;
  GET_TOKEN_INFO: { name: string; symbol: string; decimals: number; balance: string };
  GET_TOKEN_IMAGE: { url: string | null };
  GET_DISCOVERED_TOKENS: { tokens: StoredToken[] };
  HIDE_DISCOVERED_TOKEN: undefined;
  ADD_MANUAL_TOKEN: undefined;
  SCAN_TOKENS: { found: number };
}

/** Typed success/error response keyed by message type. */
export type TypedResponse<T extends MessageRequest["type"]> = MessageDataMap[T] extends void
  ? { ok: true; data?: undefined } | { ok: false; error: string }
  : { ok: true; data: MessageDataMap[T] } | { ok: false; error: string };

export { MESSAGE_TIMEOUT_MS } from "./protocol";

export async function sendMessage<M extends MessageRequest>(
  message: M,
): Promise<TypedResponse<M["type"]>> {
  const response = await Promise.race([
    browser.runtime.sendMessage(message),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Background not responding — try again")),
        MESSAGE_TIMEOUT_MS,
      ),
    ),
  ]);
  return response as TypedResponse<M["type"]>;
}

export { CHANNEL } from "./protocol";
