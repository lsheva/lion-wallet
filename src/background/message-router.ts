import type { MessageRequest, MessageResponse } from "../shared/messages";
import * as addressBook from "./handlers/address-book";
import * as approval from "./handlers/approval";
import * as connectedSites from "./handlers/connected-sites";
import * as settings from "./handlers/settings";
import * as tokens from "./handlers/tokens";
import * as wallet from "./handlers/wallet";
import { getTokenImage } from "./token-images";
import { checkForUpdate } from "./update-checker";

export async function routeBackgroundMessage(message: MessageRequest): Promise<MessageResponse> {
  switch (message.type) {
    case "RPC_REQUEST":
      return approval.handleRpcRequest(
        message.method,
        message.params,
        message.origin,
        message.faviconUrl,
      );
    case "CREATE_WALLET":
      return wallet.handleCreateWallet(message.password);
    case "IMPORT_WALLET":
      return wallet.handleImportWallet(message.mnemonic, message.password);
    case "IMPORT_PRIVATE_KEY":
      return wallet.handleImportPrivateKey(message.privateKey, message.password);
    case "GET_STATE":
      return wallet.handleGetState();
    case "GET_ACCOUNTS":
      return wallet.handleGetAccounts();
    case "ADD_ACCOUNT":
      return wallet.handleAddAccount(message.password);
    case "GET_BALANCE":
      return wallet.handleGetBalance(message.address, message.chainId);
    case "SWITCH_NETWORK":
      return wallet.handleSwitchNetwork(message.chainId);
    case "ENSURE_CHAIN_DISCOVERY":
      return wallet.handleEnsureChainDiscovery(message.chainId);
    case "SWITCH_ACCOUNT":
      return wallet.handleSwitchAccount(message.activeAccountAddress);
    case "EXPORT_PRIVATE_KEY":
      return wallet.handleExportPrivateKey(message.address, message.password);
    case "EXPORT_MNEMONIC":
      return wallet.handleExportMnemonic(message.keyringId, message.password);
    case "ADD_KEYRING_CREATE":
      return wallet.handleAddKeyringCreate(message.password);
    case "ADD_KEYRING_IMPORT":
      return wallet.handleAddKeyringImport(message.mnemonic, message.password);
    case "RENAME_KEYRING":
      return wallet.handleRenameKeyring(message.keyringId, message.label);
    case "DELETE_KEYRING":
      return wallet.handleDeleteKeyring(message.keyringId, message.password);
    case "DERIVE_ACCOUNT":
      return wallet.handleDeriveAccount(message.keyringId, message.password);
    case "RENAME_ACCOUNT":
      return wallet.handleRenameAccount(message.address, message.name);
    case "REMOVE_ACCOUNT":
      return wallet.handleRemoveAccount(message.address, message.password);
    case "GET_PENDING_APPROVAL":
      return approval.handleGetPendingApproval();
    case "ENRICH_APPROVAL":
      return approval.handleEnrichApproval(message.id);
    case "APPROVE_REQUEST":
      return approval.handleApproveRequest(message.id, message.gasSpeed, message.password);
    case "REJECT_REQUEST":
      return approval.handleRejectRequest(message.id);
    case "RESET_WALLET":
      return wallet.handleResetWallet(message.password);
    case "ESTIMATE_GAS":
      return approval.handleEstimateGas(message.chainId, message.tx);
    case "GET_ETHERSCAN_KEY":
      return settings.handleGetEtherscanKey();
    case "SET_ETHERSCAN_KEY":
      return settings.handleSetEtherscanKey(message.key);
    case "GET_RPC_PROVIDER_KEY":
      return settings.handleGetRpcProviderKey();
    case "SET_RPC_PROVIDER_KEY":
      return settings.handleSetRpcProviderKey(message.key);
    case "GET_STORAGE_MODE":
      return settings.handleGetStorageMode();
    case "CHECK_KEYCHAIN_AVAILABLE":
      return settings.handleCheckKeychainAvailable();
    case "GET_TOKEN_BALANCES":
      return wallet.handleGetTokenBalances(message.tokens);
    case "GET_TOKEN_PRICE":
      return wallet.handleGetTokenPrice(message.address, message.chainId);
    case "SEND_TOKEN":
      return wallet.handleSendToken(
        message.tokenAddress,
        message.to,
        message.amount,
        message.decimals,
      );
    case "GET_ACTIVITY":
      return settings.handleGetActivity(
        message.address,
        message.chainId,
        message.loadMore === true,
      );
    case "CLEAR_ACTIVITY_CACHE":
      return settings.handleClearActivityCache();
    case "GET_TOKEN_INFO":
      return wallet.handleGetTokenInfo(message.address, message.chainId);
    case "GET_TOKEN_IMAGE": {
      const url = await getTokenImage(message.chainId, message.address);
      return { ok: true, data: { url } };
    }
    case "GET_DISCOVERED_TOKENS":
      return tokens.handleGetDiscoveredTokens(message.chainId, message.walletAddress);
    case "HIDE_DISCOVERED_TOKEN":
      return tokens.handleHideDiscoveredToken(
        message.chainId,
        message.walletAddress,
        message.address,
      );
    case "ADD_MANUAL_TOKEN":
      return tokens.handleAddManualToken(message.address, message.chainId, message.walletAddress);
    case "SCAN_TOKENS":
      return tokens.handleScanTokens(message.chainId, message.address);
    case "MULTI_SEND":
      return wallet.handleMultiSend(message.entries);
    case "CHECK_UPDATE": {
      const info = await checkForUpdate(message.force === true);
      return { ok: true, data: info };
    }
    case "GET_ADDRESS_BOOK":
      return addressBook.handleGetAddressBook();
    case "UPSERT_ADDRESS_BOOK_ENTRY":
      return addressBook.handleUpsertAddressBookEntry(message.address, message.name);
    case "REMOVE_ADDRESS_BOOK_ENTRY":
      return addressBook.handleRemoveAddressBookEntry(message.address);
    case "GET_CONNECTED_SITES":
      return connectedSites.handleGetConnectedSites();
    case "REVOKE_CONNECTED_ORIGIN":
      return connectedSites.handleRevokeConnectedOrigin(message.origin);
    default:
      return { ok: false, error: "Unknown message type" };
  }
}
