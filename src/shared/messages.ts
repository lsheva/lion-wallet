import type { Address, Hex } from "viem";
import browser from "webextension-polyfill";
import type {
  ActivityItem,
  ApprovalData,
  GasPresets,
  GasSpeed,
  SerializedAccount,
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
  | { type: "RESET_WALLET" }
  | { type: "GET_ETHERSCAN_KEY" }
  | { type: "SET_ETHERSCAN_KEY"; key: string }
  | { type: "GET_RPC_PROVIDER_KEY" }
  | { type: "SET_RPC_PROVIDER_KEY"; key: string }
  | { type: "GET_STORAGE_MODE" }
  | { type: "CHECK_KEYCHAIN_AVAILABLE" }
  | { type: "GET_ACTIVITY"; address: Address; chainId: number; loadMore?: boolean }
  | { type: "CLEAR_ACTIVITY_CACHE" };

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
  SWITCH_NETWORK: void;
  SWITCH_ACCOUNT: void;
  EXPORT_PRIVATE_KEY: { privateKey: Hex };
  EXPORT_MNEMONIC: { mnemonic: string };
  RPC_REQUEST: { result: unknown };
  GET_PENDING_APPROVAL: ApprovalData | null;
  APPROVE_REQUEST: { result: string };
  REJECT_REQUEST: void;
  ESTIMATE_GAS: GasPresets;
  RESET_WALLET: void;
  GET_ETHERSCAN_KEY: { key: string | null };
  SET_ETHERSCAN_KEY: void;
  GET_RPC_PROVIDER_KEY: { key: string | null };
  SET_RPC_PROVIDER_KEY: void;
  GET_STORAGE_MODE: { storageMode: "keychain" | "vault" };
  CHECK_KEYCHAIN_AVAILABLE: { available: boolean; error?: string };
  GET_ACTIVITY: {
    items: ActivityItem[];
    hasMore: boolean;
    source: "etherscan" | "rpc" | "cache";
  };
  CLEAR_ACTIVITY_CACHE: void;
}

/** Typed success/error response keyed by message type. */
export type TypedResponse<T extends MessageRequest["type"]> =
  MessageDataMap[T] extends void
    ? { ok: true; data?: undefined } | { ok: false; error: string }
    : { ok: true; data: MessageDataMap[T] } | { ok: false; error: string };

const MESSAGE_TIMEOUT_MS = 60_000;

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

export const CHANNEL = "LION_WALLET";

export interface ProviderRpcRequest {
  type: typeof CHANNEL;
  direction: "request";
  id: string;
  method: string;
  params?: unknown[];
}

export interface ProviderRpcResponse {
  type: typeof CHANNEL;
  direction: "response";
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ProviderEvent {
  type: typeof CHANNEL;
  direction: "event";
  event: string;
  data: unknown;
}

export type ProviderMessage = ProviderRpcRequest | ProviderRpcResponse | ProviderEvent;
