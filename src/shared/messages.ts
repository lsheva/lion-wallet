import type { Address, Hex } from "viem";

import { hasBrowserExtensionContext } from "./extension-context";
import { MESSAGE_TIMEOUT_MS } from "./protocol";
import type {
  ActivityItem,
  AddressBookEntry,
  ApprovalData,
  ApprovalEnrichment,
  GasPresets,
  GasSpeed,
  KeyringPublic,
  MultiSendEntry,
  RecentAddress,
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
  | { type: "ADD_KEYRING_CREATE"; password?: string }
  | { type: "ADD_KEYRING_IMPORT"; mnemonic: string; password?: string }
  | { type: "RENAME_KEYRING"; keyringId: string; label: string }
  | { type: "DELETE_KEYRING"; keyringId: string; password?: string }
  | { type: "DERIVE_ACCOUNT"; keyringId: string; password?: string }
  | { type: "RENAME_ACCOUNT"; address: Address; name: string }
  | { type: "REMOVE_ACCOUNT"; address: Address; password?: string }
  | { type: "GET_BALANCE"; address: Address; chainId: number }
  | { type: "SWITCH_NETWORK"; chainId: number }
  | { type: "ENSURE_CHAIN_DISCOVERY"; chainId: number }
  | { type: "SWITCH_ACCOUNT"; activeAccountAddress: Address }
  | { type: "EXPORT_PRIVATE_KEY"; address: Address; password?: string }
  | { type: "EXPORT_MNEMONIC"; keyringId?: string; password?: string }
  | {
      type: "RPC_REQUEST";
      id: string;
      method: string;
      params?: unknown[];
      origin: string;
      faviconUrl?: string;
    }
  | { type: "GET_PENDING_APPROVAL" }
  | { type: "ENRICH_APPROVAL"; id: string }
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
  | { type: "GET_TOKEN_PRICE"; address: Address; chainId: number }
  | { type: "SEND_TOKEN"; tokenAddress: Address; to: Address; amount: string; decimals: number }
  | { type: "GET_ACTIVITY"; address: Address; chainId: number; loadMore?: boolean }
  | { type: "CLEAR_ACTIVITY_CACHE" }
  | { type: "GET_TOKEN_INFO"; address: Address; chainId: number }
  | { type: "GET_TOKEN_IMAGE"; address: Address; chainId: number }
  | { type: "GET_DISCOVERED_TOKENS"; chainId: number; walletAddress: Address }
  | { type: "HIDE_DISCOVERED_TOKEN"; chainId: number; walletAddress: Address; address: Address }
  | { type: "ADD_MANUAL_TOKEN"; address: Address; chainId: number; walletAddress: Address }
  | { type: "SCAN_TOKENS"; chainId: number; address: Address }
  | { type: "MULTI_SEND"; entries: MultiSendEntry[] }
  | { type: "CHECK_UPDATE"; force?: boolean }
  | { type: "GET_ADDRESS_BOOK" }
  | { type: "UPSERT_ADDRESS_BOOK_ENTRY"; address: Address; name: string }
  | { type: "REMOVE_ADDRESS_BOOK_ENTRY"; address: Address }
  | { type: "GET_CONNECTED_SITES" }
  | { type: "REVOKE_CONNECTED_ORIGIN"; origin: string };

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
  ADD_KEYRING_CREATE: {
    mnemonic: string;
    accounts: SerializedAccount[];
    keyrings: KeyringPublic[];
  };
  ADD_KEYRING_IMPORT: { accounts: SerializedAccount[]; keyrings: KeyringPublic[] };
  RENAME_KEYRING: undefined;
  DELETE_KEYRING: undefined;
  DERIVE_ACCOUNT: { account: SerializedAccount };
  RENAME_ACCOUNT: undefined;
  REMOVE_ACCOUNT: undefined;
  GET_BALANCE: { balance: string; nativeUsdPrice: number | null };
  SWITCH_NETWORK: undefined;
  ENSURE_CHAIN_DISCOVERY: {
    activeAccountIndices: number[];
    scannedAt: number;
  };
  SWITCH_ACCOUNT: undefined;
  EXPORT_PRIVATE_KEY: { privateKey: Hex };
  EXPORT_MNEMONIC: { mnemonic: string };
  RPC_REQUEST: { result: unknown };
  GET_PENDING_APPROVAL: ApprovalData | null;
  ENRICH_APPROVAL: ApprovalEnrichment | null;
  APPROVE_REQUEST: { result: unknown };
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
  GET_TOKEN_PRICE: { price: number | null };
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
  MULTI_SEND: { queued: number };
  CHECK_UPDATE: {
    current: string;
    latest: string;
    downloadUrl: string;
    updateAvailable: boolean;
  };
  GET_ADDRESS_BOOK: { entries: AddressBookEntry[]; recent: RecentAddress[] };
  UPSERT_ADDRESS_BOOK_ENTRY: undefined;
  REMOVE_ADDRESS_BOOK_ENTRY: undefined;
  GET_CONNECTED_SITES: { origins: string[] };
  REVOKE_CONNECTED_ORIGIN: undefined;
}

/** Typed success/error response keyed by message type. */
export type TypedResponse<T extends MessageRequest["type"]> = MessageDataMap[T] extends void
  ? { ok: true; data?: undefined } | { ok: false; error: string }
  : { ok: true; data: MessageDataMap[T] } | { ok: false; error: string };

export { MESSAGE_TIMEOUT_MS } from "./protocol";

async function sendMessageViaDevServiceWorker<M extends MessageRequest>(
  message: M,
): Promise<TypedResponse<M["type"]>> {
  const reg = await navigator.serviceWorker.ready;
  const sw = reg.active;
  if (!sw) {
    throw new TypeError(
      "Dev background service worker is not active yet — wait for registration or reload.",
    );
  }
  return new Promise((resolve, reject) => {
    const ch = new MessageChannel();
    const t = setTimeout(
      () => reject(new Error("Background not responding — try again")),
      MESSAGE_TIMEOUT_MS,
    );
    ch.port1.onmessage = (e: MessageEvent) => {
      clearTimeout(t);
      resolve(e.data as TypedResponse<M["type"]>);
    };
    sw.postMessage({ channel: "lion-dev-request", request: message }, [ch.port2]);
  });
}

export async function sendMessage<M extends MessageRequest>(
  message: M,
): Promise<TypedResponse<M["type"]>> {
  if (import.meta.env.VITE_MOCK === "true") {
    const { mockSendMessage } = await import("./messages-mock");
    return (await mockSendMessage(message)) as TypedResponse<M["type"]>;
  }

  const extId = import.meta.env.VITE_EXTENSION_ID?.trim();
  let pending: Promise<unknown>;
  if (hasBrowserExtensionContext()) {
    pending = browser.runtime.sendMessage(message);
  } else if (import.meta.env.DEV) {
    pending = sendMessageViaDevServiceWorker(message);
  } else if (extId) {
    pending = browser.runtime.sendMessage(extId, message);
  } else {
    pending = Promise.reject(
      new TypeError(
        "Not inside the extension UI. For a browser-tab build without a background, use pnpm dev:mock, or load the unpacked extension and open the popup from the toolbar.",
      ),
    );
  }

  const response = await Promise.race([
    pending,
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
