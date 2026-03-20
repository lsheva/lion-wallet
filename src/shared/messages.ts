import type { Address, Hex } from "viem";
import type { GasSpeed, SerializedAccount, TransactionParams, WalletState } from "./types";

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

export type MessageResponse = { ok: true; data?: unknown } | { ok: false; error: string };

export interface CreateWalletResponse {
  ok: true;
  data: { mnemonic: string; accounts: SerializedAccount[] };
}

export interface GetStateResponse {
  ok: true;
  data: WalletState;
}

export interface GetAccountsResponse {
  ok: true;
  data: { accounts: SerializedAccount[] };
}

export interface AddAccountResponse {
  ok: true;
  data: { account: SerializedAccount };
}

export interface GetBalanceResponse {
  ok: true;
  data: { balance: string; nativeUsdPrice: number | null };
}

export interface ExportPrivateKeyResponse {
  ok: true;
  data: { privateKey: Hex };
}

export interface ExportMnemonicResponse {
  ok: true;
  data: { mnemonic: string };
}

const MESSAGE_TIMEOUT_MS = 30_000;

export async function sendMessage(message: MessageRequest): Promise<MessageResponse> {
  const browser = (await import("webextension-polyfill")).default;
  const response = await Promise.race([
    browser.runtime.sendMessage(message),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Background not responding — try again")),
        MESSAGE_TIMEOUT_MS,
      ),
    ),
  ]);
  return response as MessageResponse;
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
