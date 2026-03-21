import type { Runtime } from "webextension-polyfill/namespaces/runtime";
import type { MessageRequest, MessageResponse } from "../shared/messages";
import { broadcastPendingCount, updateBadge } from "./broadcast";
import {
  handleApproveRequest,
  handleEstimateGas,
  handleGetPendingApproval,
  handleRejectRequest,
  handleRpcRequest,
} from "./handlers/approval";
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
  handleAddAccount,
  handleCreateWallet,
  handleExportMnemonic,
  handleExportPrivateKey,
  handleGetAccounts,
  handleGetBalance,
  handleGetState,
  handleGetTokenBalances,
  handleImportPrivateKey,
  handleImportWallet,
  handleResetWallet,
  handleSendToken,
  handleSwitchAccount,
  handleSwitchNetwork,
} from "./handlers/wallet";
import { bgLog } from "./log";
import { loadRpcProviderKey } from "./networks";
import { setApprovalCreatedCallback } from "./rpc-handler";

updateBadge();
browser.runtime.onInstalled.addListener(() => updateBadge());
browser.runtime.onStartup?.addListener(() => updateBadge());

setApprovalCreatedCallback(() => {
  updateBadge();
  broadcastPendingCount();
  try {
    (browser.action as { openPopup?: () => void }).openPopup?.();
  } catch {
    /* popup couldn't be opened programmatically */
  }
});

async function handleMessage(message: MessageRequest): Promise<MessageResponse> {
  switch (message.type) {
    case "RPC_REQUEST":
      return handleRpcRequest(message.method, message.params, message.origin);
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
    case "SWITCH_ACCOUNT":
      return handleSwitchAccount(message.accountIndex);
    case "EXPORT_PRIVATE_KEY":
      return handleExportPrivateKey(message.accountIndex, message.password);
    case "EXPORT_MNEMONIC":
      return handleExportMnemonic(message.password);
    case "GET_PENDING_APPROVAL":
      return handleGetPendingApproval();
    case "APPROVE_REQUEST":
      return handleApproveRequest(message.id, message.gasSpeed, message.password);
    case "REJECT_REQUEST":
      return handleRejectRequest(message.id);
    case "RESET_WALLET":
      return handleResetWallet();
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
    case "SEND_TOKEN":
      return handleSendToken(message.tokenAddress, message.to, message.amount, message.decimals);
    case "GET_ACTIVITY":
      return handleGetActivity(message.address, message.chainId, message.loadMore === true);
    case "CLEAR_ACTIVITY_CACHE":
      return handleClearActivityCache();
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

browser.runtime.onMessage.addListener((message: unknown, _sender: Runtime.MessageSender) => {
  const msg = message as MessageRequest;
  return handleMessage(msg).catch((err: Error) => ({
    ok: false as const,
    error: err.message,
  }));
});

loadRpcProviderKey().catch((e) => {
  bgLog("[background] loadRpcProviderKey failed:", e);
});
bgLog("[background] service worker loaded");
