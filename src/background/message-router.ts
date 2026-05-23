/**
 * Single entry point for popup → background `browser.runtime.sendMessage`
 * calls. Dispatches by `MessageRequest.type` to the appropriate
 * `handlers/<domain>` function. See AGENTS.md → "Message protocol".
 *
 * The `handlers` table below is `satisfies`-checked against every
 * `MessageRequest["type"]`, so adding a new request to `MessageRequest`
 * without registering it here is a compile-time error.
 */
import type { MessageRequest, MessageResponse } from "../shared/messages";
import * as addressBook from "./handlers/address-book";
import * as approval from "./handlers/approval";
import * as connectedSites from "./handlers/connected-sites";
import * as settings from "./handlers/settings";
import * as tokens from "./handlers/tokens";
import * as wallet from "./handlers/wallet";
import { getTokenImage } from "./token-images";
import { checkForUpdate } from "./update-checker";

type Handler<T extends MessageRequest["type"]> = (
  msg: Extract<MessageRequest, { type: T }>,
) => Promise<MessageResponse>;

type HandlerTable = {
  [T in MessageRequest["type"]]: Handler<T>;
};

const handlers = {
  RPC_REQUEST: (m) => approval.handleRpcRequest(m.method, m.params, m.origin, m.faviconUrl),
  CREATE_WALLET: (m) => wallet.handleCreateWallet(m.password),
  IMPORT_WALLET: (m) => wallet.handleImportWallet(m.mnemonic, m.password),
  IMPORT_PRIVATE_KEY: (m) => wallet.handleImportPrivateKey(m.privateKey, m.password),
  GET_STATE: () => wallet.handleGetState(),
  GET_ACCOUNTS: () => wallet.handleGetAccounts(),
  ADD_ACCOUNT: (m) => wallet.handleAddAccount(m.password),
  GET_BALANCE: (m) => wallet.handleGetBalance(m.address, m.chainId),
  SWITCH_NETWORK: (m) => wallet.handleSwitchNetwork(m.chainId),
  ENSURE_CHAIN_DISCOVERY: (m) => wallet.handleEnsureChainDiscovery(m.chainId),
  SWITCH_ACCOUNT: (m) => wallet.handleSwitchAccount(m.activeAccountAddress),
  EXPORT_PRIVATE_KEY: (m) => wallet.handleExportPrivateKey(m.address, m.password),
  EXPORT_MNEMONIC: (m) => wallet.handleExportMnemonic(m.keyringId, m.password),
  ADD_KEYRING_CREATE: (m) => wallet.handleAddKeyringCreate(m.password),
  ADD_KEYRING_IMPORT: (m) => wallet.handleAddKeyringImport(m.mnemonic, m.password),
  RENAME_KEYRING: (m) => wallet.handleRenameKeyring(m.keyringId, m.label),
  DELETE_KEYRING: (m) => wallet.handleDeleteKeyring(m.keyringId, m.password),
  DERIVE_ACCOUNT: (m) => wallet.handleDeriveAccount(m.keyringId, m.password),
  RENAME_ACCOUNT: (m) => wallet.handleRenameAccount(m.address, m.name),
  REMOVE_ACCOUNT: (m) => wallet.handleRemoveAccount(m.address, m.password),
  GET_PENDING_APPROVAL: () => approval.handleGetPendingApproval(),
  ENRICH_APPROVAL: (m) => approval.handleEnrichApproval(m.id),
  APPROVE_REQUEST: (m) => approval.handleApproveRequest(m.id, m.gasSpeed, m.password),
  REJECT_REQUEST: (m) => approval.handleRejectRequest(m.id),
  RESET_WALLET: (m) => wallet.handleResetWallet(m.password),
  ESTIMATE_GAS: (m) => approval.handleEstimateGas(m.chainId, m.tx),
  GET_ETHERSCAN_KEY: () => settings.handleGetEtherscanKey(),
  SET_ETHERSCAN_KEY: (m) => settings.handleSetEtherscanKey(m.key),
  GET_RPC_PROVIDER_KEY: () => settings.handleGetRpcProviderKey(),
  SET_RPC_PROVIDER_KEY: (m) => settings.handleSetRpcProviderKey(m.key),
  GET_STORAGE_MODE: () => settings.handleGetStorageMode(),
  CHECK_KEYCHAIN_AVAILABLE: () => settings.handleCheckKeychainAvailable(),
  GET_TOKEN_BALANCES: (m) => wallet.handleGetTokenBalances(m.tokens),
  GET_TOKEN_PRICE: (m) => wallet.handleGetTokenPrice(m.address, m.chainId),
  SEND_TOKEN: (m) => wallet.handleSendToken(m.tokenAddress, m.to, m.amount, m.decimals),
  GET_ACTIVITY: (m) => settings.handleGetActivity(m.address, m.chainId, m.loadMore === true),
  CLEAR_ACTIVITY_CACHE: () => settings.handleClearActivityCache(),
  GET_TOKEN_INFO: (m) => wallet.handleGetTokenInfo(m.address, m.chainId),
  GET_TOKEN_IMAGE: async (m) => {
    const url = await getTokenImage(m.chainId, m.address);
    return { ok: true, data: { url } };
  },
  GET_DISCOVERED_TOKENS: (m) => tokens.handleGetDiscoveredTokens(m.chainId, m.walletAddress),
  HIDE_DISCOVERED_TOKEN: (m) =>
    tokens.handleHideDiscoveredToken(m.chainId, m.walletAddress, m.address),
  ADD_MANUAL_TOKEN: (m) => tokens.handleAddManualToken(m.address, m.chainId, m.walletAddress),
  SCAN_TOKENS: (m) => tokens.handleScanTokens(m.chainId, m.address),
  MULTI_SEND: (m) => wallet.handleMultiSend(m.entries),
  CHECK_UPDATE: async (m) => {
    const info = await checkForUpdate(m.force === true);
    return { ok: true, data: info };
  },
  GET_ADDRESS_BOOK: () => addressBook.handleGetAddressBook(),
  UPSERT_ADDRESS_BOOK_ENTRY: (m) => addressBook.handleUpsertAddressBookEntry(m.address, m.name),
  REMOVE_ADDRESS_BOOK_ENTRY: (m) => addressBook.handleRemoveAddressBookEntry(m.address),
  GET_CONNECTED_SITES: () => connectedSites.handleGetConnectedSites(),
  REVOKE_CONNECTED_ORIGIN: (m) => connectedSites.handleRevokeConnectedOrigin(m.origin),
} satisfies HandlerTable;

export async function routeBackgroundMessage(message: MessageRequest): Promise<MessageResponse> {
  const handler = handlers[message.type] as Handler<MessageRequest["type"]> | undefined;
  if (!handler) return { ok: false, error: "Unknown message type" };
  return handler(message);
}
