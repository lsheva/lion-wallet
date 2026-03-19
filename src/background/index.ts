import browser from "webextension-polyfill";
import type { MessageRequest, MessageResponse } from "../shared/messages";
import { CHANNEL } from "../shared/messages";
import type { WalletState } from "../shared/types";
import { AUTO_LOCK_TIMEOUT_MS } from "../shared/constants";
import { encryptVault, decryptVault, isVaultInitialized } from "./vault";
import * as wallet from "./wallet";
import {
  getActiveNetworkId,
  setActiveNetworkId,
  getPublicClient,
} from "./networks";
import { formatEther, numberToHex } from "viem";
import { handleRpc } from "./rpc-handler";

let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

function resetAutoLock(): void {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  if (wallet.isUnlocked()) {
    autoLockTimer = setTimeout(() => {
      wallet.clearState();
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

async function getWalletState(): Promise<WalletState> {
  return {
    isInitialized: await isVaultInitialized(),
    isUnlocked: wallet.isUnlocked(),
    accounts: wallet.getAccounts(),
    activeAccountIndex: wallet.getActiveAccountIndex(),
    activeNetworkId: await getActiveNetworkId(),
  };
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
      return { ok: true, data: { address } };
    }

    case "UNLOCK": {
      const data = await decryptVault(message.password);
      wallet.loadState(data);
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
      const account = wallet.addAccount();
      await encryptVault(wallet.buildVaultData(), "");
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
