import type { MessageRequest, MessageResponse } from "../shared/messages";
import {
  handleGetAddressBook,
  handleRemoveAddressBookEntry,
  handleUpsertAddressBookEntry,
} from "./handlers/address-book";
import {
  handleApproveRequest,
  handleEnrichApproval,
  handleEstimateGas,
  handleGetPendingApproval,
  handleRejectRequest,
  handleRpcRequest,
} from "./handlers/approval";
import { handleGetConnectedSites, handleRevokeConnectedOrigin } from "./handlers/connected-sites";
import {
  handleCheckKeychainAvailable,
  handleClearActivityCache,
  handleGetActivity,
  handleGetEtherscanKey,
  handleGetRpcProviderKey,
  handleGetStorageMode,
  handleSetEtherscanKey,
  handleSetRpcProviderKey,
} from "./handlers/settings";
import {
  handleAddManualToken,
  handleGetDiscoveredTokens,
  handleHideDiscoveredToken,
  handleScanTokens,
} from "./handlers/tokens";
import {
  handleAddAccount,
  handleAddKeyringCreate,
  handleAddKeyringImport,
  handleCreateWallet,
  handleDeleteKeyring,
  handleDeriveAccount,
  handleEnsureChainDiscovery,
  handleExportMnemonic,
  handleExportPrivateKey,
  handleGetAccounts,
  handleGetBalance,
  handleGetState,
  handleGetTokenBalances,
  handleGetTokenInfo,
  handleGetTokenPrice,
  handleImportPrivateKey,
  handleImportWallet,
  handleMultiSend,
  handleRemoveAccount,
  handleRenameAccount,
  handleRenameKeyring,
  handleResetWallet,
  handleSendToken,
  handleSwitchAccount,
  handleSwitchNetwork,
} from "./handlers/wallet";
import { getTokenImage } from "./token-images";
import { checkForUpdate } from "./update-checker";

export async function routeBackgroundMessage(message: MessageRequest): Promise<MessageResponse> {
  switch (message.type) {
    case "RPC_REQUEST":
      return handleRpcRequest(message.method, message.params, message.origin, message.faviconUrl);
    case "CREATE_WALLET":
      return handleCreateWallet(message.password);
    case "IMPORT_WALLET":
      return handleImportWallet(message.mnemonic, message.password);
    case "IMPORT_PRIVATE_KEY":
      return handleImportPrivateKey(message.privateKey, message.password);
    case "GET_STATE":
      return handleGetState();
    case "GET_ACCOUNTS":
      return handleGetAccounts();
    case "ADD_ACCOUNT":
      return handleAddAccount(message.password);
    case "GET_BALANCE":
      return handleGetBalance(message.address, message.chainId);
    case "SWITCH_NETWORK":
      return handleSwitchNetwork(message.chainId);
    case "ENSURE_CHAIN_DISCOVERY":
      return handleEnsureChainDiscovery(message.chainId);
    case "SWITCH_ACCOUNT":
      return handleSwitchAccount(message.activeAccountAddress);
    case "EXPORT_PRIVATE_KEY":
      return handleExportPrivateKey(message.address, message.password);
    case "EXPORT_MNEMONIC":
      return handleExportMnemonic(message.keyringId, message.password);
    case "ADD_KEYRING_CREATE":
      return handleAddKeyringCreate(message.password);
    case "ADD_KEYRING_IMPORT":
      return handleAddKeyringImport(message.mnemonic, message.password);
    case "RENAME_KEYRING":
      return handleRenameKeyring(message.keyringId, message.label);
    case "DELETE_KEYRING":
      return handleDeleteKeyring(message.keyringId, message.password);
    case "DERIVE_ACCOUNT":
      return handleDeriveAccount(message.keyringId, message.password);
    case "RENAME_ACCOUNT":
      return handleRenameAccount(message.address, message.name);
    case "REMOVE_ACCOUNT":
      return handleRemoveAccount(message.address, message.password);
    case "GET_PENDING_APPROVAL":
      return handleGetPendingApproval();
    case "ENRICH_APPROVAL":
      return handleEnrichApproval(message.id);
    case "APPROVE_REQUEST":
      return handleApproveRequest(message.id, message.gasSpeed, message.password);
    case "REJECT_REQUEST":
      return handleRejectRequest(message.id);
    case "RESET_WALLET":
      return handleResetWallet(message.password);
    case "ESTIMATE_GAS":
      return handleEstimateGas(message.chainId, message.tx);
    case "GET_ETHERSCAN_KEY":
      return handleGetEtherscanKey();
    case "SET_ETHERSCAN_KEY":
      return handleSetEtherscanKey(message.key);
    case "GET_RPC_PROVIDER_KEY":
      return handleGetRpcProviderKey();
    case "SET_RPC_PROVIDER_KEY":
      return handleSetRpcProviderKey(message.key);
    case "GET_STORAGE_MODE":
      return handleGetStorageMode();
    case "CHECK_KEYCHAIN_AVAILABLE":
      return handleCheckKeychainAvailable();
    case "GET_TOKEN_BALANCES":
      return handleGetTokenBalances(message.tokens);
    case "GET_TOKEN_PRICE":
      return handleGetTokenPrice(message.address, message.chainId);
    case "SEND_TOKEN":
      return handleSendToken(message.tokenAddress, message.to, message.amount, message.decimals);
    case "GET_ACTIVITY":
      return handleGetActivity(message.address, message.chainId, message.loadMore === true);
    case "CLEAR_ACTIVITY_CACHE":
      return handleClearActivityCache();
    case "GET_TOKEN_INFO":
      return handleGetTokenInfo(message.address, message.chainId);
    case "GET_TOKEN_IMAGE": {
      const url = await getTokenImage(message.chainId, message.address);
      return { ok: true, data: { url } };
    }
    case "GET_DISCOVERED_TOKENS":
      return handleGetDiscoveredTokens(message.chainId, message.walletAddress);
    case "HIDE_DISCOVERED_TOKEN":
      return handleHideDiscoveredToken(message.chainId, message.walletAddress, message.address);
    case "ADD_MANUAL_TOKEN":
      return handleAddManualToken(message.address, message.chainId, message.walletAddress);
    case "SCAN_TOKENS":
      return handleScanTokens(message.chainId, message.address);
    case "MULTI_SEND":
      return handleMultiSend(message.entries);
    case "CHECK_UPDATE": {
      const info = await checkForUpdate(message.force === true);
      return { ok: true, data: info };
    }
    case "GET_ADDRESS_BOOK":
      return handleGetAddressBook();
    case "UPSERT_ADDRESS_BOOK_ENTRY":
      return handleUpsertAddressBookEntry(message.address, message.name);
    case "REMOVE_ADDRESS_BOOK_ENTRY":
      return handleRemoveAddressBookEntry(message.address);
    case "GET_CONNECTED_SITES":
      return handleGetConnectedSites();
    case "REVOKE_CONNECTED_ORIGIN":
      return handleRevokeConnectedOrigin(message.origin);
    default:
      return { ok: false, error: "Unknown message type" };
  }
}
