import browser from "webextension-polyfill";
import type { MessageRequest, MessageResponse } from "../shared/messages";
import { CHANNEL } from "../shared/messages";
import type { WalletState, GasSpeed, TransactionParams } from "../shared/types";
import { AUTO_LOCK_TIMEOUT_MS } from "../shared/constants";
import { encryptVault, decryptVault, isVaultInitialized, clearVault, getCachedPassword, clearCachedPassword } from "./vault";
import * as wallet from "./wallet";
import {
  getActiveNetworkId,
  setActiveNetworkId,
  getPublicClient,
} from "./networks";
import { formatEther, numberToHex, type Address } from "viem";
import { handleRpc, setApprovalCreatedCallback, notifyUnlocked, rejectUnlockWaiters } from "./rpc-handler";
import {
  getPendingApproval,
  getPendingCount,
  resolvePendingApproval,
  rejectPendingApproval,
  clearAllPending,
} from "./approval";
import {
  sendTransaction,
  signTransaction,
  personalSign,
  ethSign,
  signTypedDataV4,
  estimateGasPresets,
} from "./signing";

let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

function resetAutoLock(): void {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  if (wallet.isUnlocked()) {
    autoLockTimer = setTimeout(() => {
      wallet.clearState();
      clearAllPending();
      rejectUnlockWaiters();
      clearCachedPassword();
      broadcastEvent("accountsChanged", []);
      console.log("[background] auto-locked due to inactivity");
    }, AUTO_LOCK_TIMEOUT_MS);
  }
}

function broadcastEvent(event: string, data: unknown): void {
  const payload = {
    type: CHANNEL,
    direction: "event" as const,
    event,
    data,
  };
  browser.tabs.query({}).then((tabs: browser.Tabs.Tab[]) => {
    for (const tab of tabs) {
      if (tab.id != null) {
        browser.tabs.sendMessage(tab.id, payload).catch(() => {});
      }
    }
  });
}

function updateBadge(): void {
  const count = getPendingCount();
  browser.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  if (count > 0) {
    browser.action.setBadgeBackgroundColor({ color: "#6366f1" });
  }
}

setApprovalCreatedCallback(() => {
  updateBadge();
  try {
    (browser.action as { openPopup?: () => void }).openPopup?.();
  } catch {
    // popup couldn't be opened programmatically; badge already updated
  }
});

async function getWalletState(): Promise<WalletState> {
  return {
    isInitialized: await isVaultInitialized(),
    isUnlocked: wallet.isUnlocked(),
    accounts: wallet.getAccounts(),
    activeAccountIndex: wallet.getActiveAccountIndex(),
    activeNetworkId: await getActiveNetworkId(),
  };
}

async function executeApproval(
  id: string,
  gasSpeed: GasSpeed = "normal",
): Promise<MessageResponse> {
  const pending = getPendingApproval();
  if (!pending || pending.id !== id) {
    return { ok: false, error: "No matching pending approval" };
  }

  try {
    let result: unknown;
    const { method, params, chainId } = pending;

    switch (method) {
      case "eth_sendTransaction": {
        const txParams = params[0] as TransactionParams;
        const hash = await sendTransaction(chainId, txParams, gasSpeed);
        result = hash;
        break;
      }
      case "eth_signTransaction": {
        const txParams = params[0] as TransactionParams;
        const signed = await signTransaction(chainId, txParams, gasSpeed);
        result = signed;
        break;
      }
      case "personal_sign": {
        const [message] = params as [string, Address];
        result = await personalSign(message);
        break;
      }
      case "eth_sign": {
        const [, hash] = params as [Address, `0x${string}`];
        result = await ethSign(hash);
        break;
      }
      case "eth_signTypedData_v4":
      case "eth_signTypedData": {
        result = await signTypedDataV4(params as [Address, string]);
        break;
      }
      default:
        rejectPendingApproval(id, `Unsupported method: ${method}`);
        return { ok: false, error: `Unsupported signing method: ${method}` };
    }

    resolvePendingApproval(id, result);
    updateBadge();
    return { ok: true, data: { result } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Signing failed";
    rejectPendingApproval(id, msg);
    updateBadge();
    return { ok: false, error: msg };
  }
}

async function handleMessage(
  message: MessageRequest,
): Promise<MessageResponse> {
  resetAutoLock();

  switch (message.type) {
    case "RPC_REQUEST": {
      const result = await handleRpc(message.method, message.params, {
        origin: message.origin,
      });
      return { ok: true, data: result };
    }

    case "CREATE_WALLET": {
      const mnemonic = wallet.createMnemonic();
      const account = wallet.deriveAccount(mnemonic, 0);
      const accounts = [account];

      wallet.loadState({
        mnemonic,
        accounts,
        activeAccountIndex: 0,
      });

      await encryptVault(wallet.buildVaultData(), message.password);
      return { ok: true, data: { mnemonic, accounts } };
    }

    case "IMPORT_WALLET": {
      const account = wallet.deriveAccount(message.mnemonic, 0);
      const accounts = [account];

      wallet.loadState({
        mnemonic: message.mnemonic,
        accounts,
        activeAccountIndex: 0,
      });

      await encryptVault(wallet.buildVaultData(), message.password);
      return { ok: true, data: { accounts } };
    }

    case "IMPORT_PRIVATE_KEY": {
      const address = wallet.importFromPrivateKey(message.privateKey);
      const mnemonic = wallet.createMnemonic();
      const imported: import("../shared/types").SerializedAccount = {
        name: "Imported Account",
        address,
        path: "imported",
        index: 0,
      };

      wallet.loadState({
        mnemonic,
        accounts: [imported],
        activeAccountIndex: 0,
      });
      wallet.storeImportedKey(address, message.privateKey);

      await encryptVault(wallet.buildVaultData(), message.password);
      return { ok: true, data: { accounts: [imported] } };
    }

    case "UNLOCK": {
      const data = await decryptVault(message.password);
      wallet.loadState(data);
      notifyUnlocked();
      const state = await getWalletState();
      const accounts = wallet.getAccounts();
      if (accounts.length > 0) {
        broadcastEvent("accountsChanged", accounts.map((a) => a.address));
        broadcastEvent("connect", { chainId: numberToHex(state.activeNetworkId) });
      }
      return { ok: true, data: state };
    }

    case "LOCK": {
      wallet.clearState();
      clearAllPending();
      rejectUnlockWaiters();
      clearCachedPassword();
      if (autoLockTimer) clearTimeout(autoLockTimer);
      broadcastEvent("accountsChanged", []);
      broadcastEvent("disconnect", { code: 4900, message: "Wallet locked" });
      return { ok: true };
    }

    case "GET_STATE": {
      return { ok: true, data: await getWalletState() };
    }

    case "GET_ACCOUNTS": {
      return { ok: true, data: { accounts: wallet.getAccounts() } };
    }

    case "ADD_ACCOUNT": {
      const pw = getCachedPassword();
      if (!pw) {
        return { ok: false, error: "Wallet is locked — cannot persist new account" };
      }
      const account = wallet.addAccount();
      await encryptVault(wallet.buildVaultData(), pw);
      broadcastEvent("accountsChanged", wallet.getAccounts().map((a) => a.address));
      return { ok: true, data: { account } };
    }

    case "GET_BALANCE": {
      const client = getPublicClient(message.chainId);
      const balance = await client.getBalance({
        address: message.address,
      });
      return { ok: true, data: { balance: formatEther(balance) } };
    }

    case "SWITCH_NETWORK": {
      await setActiveNetworkId(message.chainId);
      broadcastEvent("chainChanged", numberToHex(message.chainId));
      return { ok: true };
    }

    case "SWITCH_ACCOUNT": {
      wallet.setActiveAccountIndex(message.accountIndex);
      const accounts = wallet.getAccounts();
      const active = accounts[message.accountIndex];
      if (active) {
        broadcastEvent("accountsChanged", accounts.map((a) => a.address));
      }
      return { ok: true };
    }

    case "EXPORT_PRIVATE_KEY": {
      const vaultData = await decryptVault(message.password);
      const privateKey = wallet.getPrivateKeyForAccount(
        vaultData.mnemonic,
        message.accountIndex,
      );
      return { ok: true, data: { privateKey } };
    }

    case "EXPORT_MNEMONIC": {
      const vaultData = await decryptVault(message.password);
      return { ok: true, data: { mnemonic: vaultData.mnemonic } };
    }

    case "GET_PENDING_APPROVAL": {
      const pending = getPendingApproval();
      if (!pending) {
        return { ok: true, data: null };
      }

      let gasPresets = null;
      if (pending.method === "eth_sendTransaction" || pending.method === "eth_signTransaction") {
        try {
          const txParams = pending.params[0] as TransactionParams;
          gasPresets = await estimateGasPresets(pending.chainId, txParams);
        } catch (e) {
          console.warn("[background] gas estimation failed:", e);
        }
      }

      const activeAccount = wallet.getAccounts()[wallet.getActiveAccountIndex()];
      return {
        ok: true,
        data: {
          approval: pending,
          gasPresets,
          account: activeAccount,
          queueSize: getPendingCount(),
        },
      };
    }

    case "APPROVE_REQUEST": {
      return executeApproval(message.id, message.gasSpeed);
    }

    case "REJECT_REQUEST": {
      const rejected = rejectPendingApproval(message.id);
      updateBadge();
      if (!rejected) {
        return { ok: false, error: "No matching pending approval" };
      }
      return { ok: true };
    }

    case "RESET_WALLET": {
      wallet.clearState();
      clearAllPending();
      rejectUnlockWaiters();
      clearCachedPassword();
      await clearVault();
      if (autoLockTimer) clearTimeout(autoLockTimer);
      broadcastEvent("accountsChanged", []);
      broadcastEvent("disconnect", { code: 4900, message: "Wallet reset" });
      return { ok: true };
    }

    case "ESTIMATE_GAS": {
      try {
        const presets = await estimateGasPresets(message.chainId, message.tx);
        return { ok: true, data: presets };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Gas estimation failed";
        return { ok: false, error: msg };
      }
    }

    default:
      return { ok: false, error: `Unknown message type` };
  }
}

browser.runtime.onMessage.addListener(
  (message: unknown, _sender: browser.Runtime.MessageSender) => {
    const msg = message as MessageRequest;
    return handleMessage(msg).catch((err: Error) => ({
      ok: false as const,
      error: err.message,
    }));
  },
);

console.log("[background] service worker loaded");
