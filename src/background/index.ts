import { type Address, formatEther, type Hex, numberToHex } from "viem";
import browser from "webextension-polyfill";
import type { MessageRequest, MessageResponse } from "../shared/messages";
import { CHANNEL } from "../shared/messages";
import type { GasSpeed, TransactionParams, WalletState } from "../shared/types";
import {
  clearAllPending,
  getPendingApproval,
  getPendingCount,
  rejectPendingApproval,
  resolvePendingApproval,
} from "./approval";
import { fetchNativePrice } from "./etherscan";
import * as keychain from "./keychain";
import { bgLog } from "./log";
import {
  getActiveNetworkId,
  getNetworkConfig,
  getPublicClient,
  hasRpcProviderKey,
  loadRpcProviderKey,
  setActiveNetworkId,
  setRpcProviderKeyInMemory,
} from "./networks";
import { fetchPrices } from "./prices";
import { handleRpc, setApprovalCreatedCallback } from "./rpc-handler";
import {
  estimateGasPresets,
  ethSign,
  getAccountForSigning,
  personalSign,
  sendTransaction,
  signTransaction,
  signTypedDataV4,
} from "./signing";
import { decodeTx } from "./tx-decoder";
import { simulateTx } from "./tx-simulator";
import {
  clearVault,
  decryptVault,
  encryptVault,
  getStorageMode,
  isVaultInitialized,
  loadAccountsMeta,
  type StorageMode,
  saveAccountsMeta,
  setStorageMode,
} from "./vault";
import * as wallet from "./wallet";

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

function broadcastPendingCount(): void {
  const count = getPendingCount();
  browser.runtime.sendMessage({ type: "PENDING_COUNT", count }).catch(() => {});
}

/** RGBA 0–255 — WebKit/Safari often ignores hex strings for badge color. */
const BADGE_THEME_RGBA: [number, number, number, number] = [217, 119, 6, 255];

function updateBadge(): void {
  const count = getPendingCount();
  browser.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  void browser.action.setBadgeBackgroundColor({ color: BADGE_THEME_RGBA });
}

updateBadge();
browser.runtime.onInstalled.addListener(() => updateBadge());
browser.runtime.onStartup?.addListener(() => updateBadge());

setApprovalCreatedCallback(() => {
  updateBadge();
  broadcastPendingCount();
  try {
    // Opening the popover focuses the toolbar item — Safari may still draw system selection (often blue); not controllable from JS.
    (browser.action as { openPopup?: () => void }).openPopup?.();
  } catch {
    /* popup couldn't be opened programmatically */
  }
});

async function getWalletState(): Promise<WalletState> {
  const meta = await loadAccountsMeta();
  const mode = await getStorageMode();
  return {
    isInitialized: await isVaultInitialized(),
    storageMode: mode,
    accounts: meta?.accounts ?? [],
    activeAccountIndex: meta?.activeAccountIndex ?? 0,
    activeNetworkId: await getActiveNetworkId(),
  };
}

async function retrieveMnemonic(mode: StorageMode, password?: string): Promise<string> {
  if (mode === "keychain") {
    const mnemonic = await keychain.retrieveMnemonic();
    if (!mnemonic) throw new Error("Authentication failed or cancelled");
    return mnemonic;
  }
  if (!password) throw new Error("Password required");
  const data = await decryptVault(password);
  return data.mnemonic;
}

async function retrieveImportedKey(
  mode: StorageMode,
  address: Address,
  password?: string,
): Promise<Hex | null> {
  if (mode === "keychain") {
    return keychain.retrieveImportedKey(address);
  }
  if (!password) return null;
  const data = await decryptVault(password);
  const importedKeys = (data as unknown as Record<string, unknown>).importedKeys as
    | Record<string, string>
    | undefined;
  if (!importedKeys) return null;
  return (importedKeys[address.toLowerCase()] as Hex) ?? null;
}

async function executeApproval(
  id: string,
  gasSpeed: GasSpeed = "normal",
  password?: string,
): Promise<MessageResponse> {
  const pending = getPendingApproval();
  if (!pending || pending.id !== id) {
    return { ok: false, error: "No matching pending approval" };
  }

  try {
    const mode = await getStorageMode();
    const meta = await loadAccountsMeta();
    if (!meta) return { ok: false, error: "No accounts found" };

    const mnemonic = await retrieveMnemonic(mode, password);
    const active = meta.accounts[meta.activeAccountIndex];
    let importedKey: Hex | undefined;
    if (active?.path === "imported") {
      importedKey = (await retrieveImportedKey(mode, active.address, password)) ?? undefined;
    }

    const account = getAccountForSigning(
      mnemonic,
      meta.activeAccountIndex,
      meta.accounts,
      importedKey,
    );

    let result: unknown;
    const { method, params, chainId } = pending;

    switch (method) {
      case "eth_sendTransaction": {
        const txParams = params[0] as TransactionParams;
        result = await sendTransaction(account, chainId, txParams, gasSpeed);
        import("./activity")
          .then(({ pushActivityItem }) =>
            pushActivityItem(account.address, chainId, {
              hash: result as string,
              from: account.address,
              to: txParams.to ?? "",
              value: txParams.value ? String(BigInt(txParams.value)) : "0",
              ts: Math.floor(Date.now() / 1000),
              error: false,
              method: txParams.data?.slice(0, 10) ?? "",
              fn: "",
              block: 0,
              transfers: [],
              decoded: null,
              events: [],
            }),
          )
          .catch(() => {});
        break;
      }
      case "eth_signTransaction": {
        const txParams = params[0] as TransactionParams;
        result = await signTransaction(account, chainId, txParams, gasSpeed);
        break;
      }
      case "personal_sign": {
        const [message] = params as [string, Address];
        result = await personalSign(account, message);
        break;
      }
      case "eth_sign": {
        const [, hash] = params as [Address, `0x${string}`];
        result = await ethSign(account, hash);
        break;
      }
      case "eth_signTypedData_v4":
      case "eth_signTypedData": {
        result = await signTypedDataV4(account, params as [Address, string]);
        break;
      }
      default:
        rejectPendingApproval(id, `Unsupported method: ${method}`);
        return { ok: false, error: `Unsupported signing method: ${method}` };
    }

    resolvePendingApproval(id, result);
    updateBadge();
    broadcastPendingCount();
    return { ok: true, data: { result } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Signing failed";
    rejectPendingApproval(id, msg);
    updateBadge();
    broadcastPendingCount();
    return { ok: false, error: msg };
  }
}

async function handleMessage(message: MessageRequest): Promise<MessageResponse> {
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

      if (!message.password) {
        const probe = await keychain.isKeychainAvailable();
        bgLog("[create] probe:", JSON.stringify(probe));
        if (probe.available) {
          const storeRes = await keychain.storeMnemonic(mnemonic);
          bgLog("[create] storeMnemonic:", JSON.stringify(storeRes));
          if (storeRes.ok) {
            await setStorageMode("keychain");
            await saveAccountsMeta(accounts, 0);
            broadcastEvent(
              "accountsChanged",
              accounts.map((a) => a.address),
            );
            return { ok: true, data: { mnemonic, accounts } };
          }
          return {
            ok: false,
            error: `Keychain store failed: ${storeRes.error}`,
          };
        }
        return {
          ok: false,
          error: `Keychain not available: ${probe.error ?? "probe returned false"}`,
        };
      }
      await setStorageMode("vault");
      await encryptVault({ mnemonic, accounts, activeAccountIndex: 0 }, message.password);
      await saveAccountsMeta(accounts, 0);
      broadcastEvent(
        "accountsChanged",
        accounts.map((a) => a.address),
      );
      return { ok: true, data: { mnemonic, accounts } };
    }

    case "IMPORT_WALLET": {
      const account = wallet.deriveAccount(message.mnemonic, 0);
      const accounts = [account];

      if (!message.password) {
        const probe = await keychain.isKeychainAvailable();
        bgLog("[import] probe:", JSON.stringify(probe));
        if (probe.available) {
          const storeRes = await keychain.storeMnemonic(message.mnemonic);
          bgLog("[import] storeMnemonic:", JSON.stringify(storeRes));
          if (storeRes.ok) {
            await setStorageMode("keychain");
            await saveAccountsMeta(accounts, 0);
            broadcastEvent(
              "accountsChanged",
              accounts.map((a) => a.address),
            );
            return { ok: true, data: { accounts } };
          }
          return {
            ok: false,
            error: `Keychain store failed: ${storeRes.error}`,
          };
        }
        return {
          ok: false,
          error: `Keychain not available: ${probe.error ?? "probe returned false"}`,
        };
      }
      await setStorageMode("vault");
      await encryptVault(
        { mnemonic: message.mnemonic, accounts, activeAccountIndex: 0 },
        message.password,
      );
      await saveAccountsMeta(accounts, 0);
      broadcastEvent(
        "accountsChanged",
        accounts.map((a) => a.address),
      );
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
      const accounts = [imported];

      if (!message.password) {
        const probe = await keychain.isKeychainAvailable();
        bgLog("[importKey] probe:", JSON.stringify(probe));
        if (probe.available) {
          const mnemonicRes = await keychain.storeMnemonic(mnemonic);
          const keyRes = await keychain.storeImportedKey(address, message.privateKey);
          bgLog(
            "[importKey] storeMnemonic:",
            JSON.stringify(mnemonicRes),
            "storeKey:",
            JSON.stringify(keyRes),
          );
          if (mnemonicRes.ok && keyRes.ok) {
            await setStorageMode("keychain");
            await saveAccountsMeta(accounts, 0);
            broadcastEvent(
              "accountsChanged",
              accounts.map((a) => a.address),
            );
            return { ok: true, data: { accounts } };
          }
          const errors = [
            !mnemonicRes.ok ? `mnemonic: ${mnemonicRes.error}` : "",
            !keyRes.ok ? `key: ${keyRes.error}` : "",
          ]
            .filter(Boolean)
            .join("; ");
          return {
            ok: false,
            error: `Keychain store failed: ${errors}`,
          };
        }
        return {
          ok: false,
          error: `Keychain not available: ${probe.error ?? "probe returned false"}`,
        };
      }
      await setStorageMode("vault");
      await encryptVault({ mnemonic, accounts, activeAccountIndex: 0 }, message.password);
      await saveAccountsMeta(accounts, 0);
      broadcastEvent(
        "accountsChanged",
        accounts.map((a) => a.address),
      );
      return { ok: true, data: { accounts } };
    }

    case "GET_STATE": {
      return { ok: true, data: await getWalletState() };
    }

    case "GET_ACCOUNTS": {
      const meta = await loadAccountsMeta();
      return { ok: true, data: { accounts: meta?.accounts ?? [] } };
    }

    case "ADD_ACCOUNT": {
      const mode = await getStorageMode();
      const meta = await loadAccountsMeta();
      if (!meta) return { ok: false, error: "Wallet not initialized" };

      const mnemonic = await retrieveMnemonic(mode, message.password);
      const nextIndex = meta.accounts.length;
      const account = wallet.deriveAccount(mnemonic, nextIndex);
      const updatedAccounts = [...meta.accounts, account];

      await saveAccountsMeta(updatedAccounts, meta.activeAccountIndex);

      if (mode === "vault") {
        if (!message.password) {
          return { ok: false, error: "Password required to persist account" };
        }
        await encryptVault(
          {
            mnemonic,
            accounts: updatedAccounts,
            activeAccountIndex: meta.activeAccountIndex,
          },
          message.password,
        );
      }

      broadcastEvent(
        "accountsChanged",
        updatedAccounts.map((a) => a.address),
      );
      return { ok: true, data: { account } };
    }

    case "GET_BALANCE": {
      const client = getPublicClient(message.chainId);
      const balance = await client.getBalance({
        address: message.address,
      });
      const cfg = getNetworkConfig(message.chainId);
      const isTestnet = cfg?.chain.testnet === true;
      const nativeUsdPrice = isTestnet ? 0 : await fetchNativePrice(message.chainId);
      return {
        ok: true,
        data: { balance: formatEther(balance), nativeUsdPrice },
      };
    }

    case "SWITCH_NETWORK": {
      await setActiveNetworkId(message.chainId);
      broadcastEvent("chainChanged", numberToHex(message.chainId));
      return { ok: true };
    }

    case "SWITCH_ACCOUNT": {
      const meta = await loadAccountsMeta();
      if (meta) {
        await saveAccountsMeta(meta.accounts, message.accountIndex);
        broadcastEvent(
          "accountsChanged",
          meta.accounts.map((a) => a.address),
        );
      }
      return { ok: true };
    }

    case "EXPORT_PRIVATE_KEY": {
      const mode = await getStorageMode();
      const mnemonic = await retrieveMnemonic(mode, message.password);
      const privateKey = wallet.getPrivateKeyForAccount(mnemonic, message.accountIndex);
      return { ok: true, data: { privateKey } };
    }

    case "EXPORT_MNEMONIC": {
      const mode = await getStorageMode();
      const mnemonic = await retrieveMnemonic(mode, message.password);
      return { ok: true, data: { mnemonic } };
    }

    case "GET_PENDING_APPROVAL": {
      const pending = getPendingApproval();
      if (!pending) {
        return { ok: true, data: null };
      }

      const meta = await loadAccountsMeta();
      const activeAccount = meta?.accounts[meta.activeAccountIndex];
      let gasPresets = null;
      let decoded = null;
      let transfers = null;
      let nativeUsdPrice = null;
      let decodedVia: string | null = null;
      let simulatedVia: string | null = null;

      const isTxMethod =
        pending.method === "eth_sendTransaction" || pending.method === "eth_signTransaction";
      const _debug: string[] = [];

      const etherscanKeyResult = await browser.storage.local.get("etherscanApiKey");
      const hasEtherscanKey = !!(etherscanKeyResult.etherscanApiKey as string);
      const hasAlchemyKey = hasRpcProviderKey();

      if (isTxMethod) {
        const txParams = pending.params[0] as TransactionParams;
        _debug.push(
          `method=${pending.method} to=${txParams.to} data=${txParams.data?.slice(0, 20) ?? "none"} value=${txParams.value ?? "none"} chainId=${pending.chainId}`,
        );

        try {
          gasPresets = await estimateGasPresets(pending.chainId, txParams, activeAccount?.address);
          _debug.push("gas: OK");
        } catch (e) {
          _debug.push(`gas: FAIL ${e instanceof Error ? e.message : e}`);
        }

        try {
          const [decodeResult, simResult] = await Promise.allSettled([
            decodeTx(txParams, pending.chainId, _debug),
            simulateTx(
              txParams,
              pending.chainId,
              activeAccount?.address ?? ("0x" as Address),
              _debug,
            ),
          ]);

          if (decodeResult.status === "fulfilled") {
            decoded = decodeResult.value.decoded;
            decodedVia = decodeResult.value.via;
          }

          let simTransfers: import("../shared/types").TokenTransfer[] = [];
          if (simResult.status === "fulfilled" && simResult.value) {
            simTransfers = simResult.value.transfers;
            simulatedVia = simResult.value.via;
          }

          const network = getNetworkConfig(pending.chainId);
          const nativeSymbol = network?.chain.nativeCurrency.symbol ?? "ETH";

          const tokenAddresses = simTransfers
            .map((t) => t.tokenAddress)
            .filter((a): a is string => !!a);

          const priceMap = await fetchPrices(nativeSymbol, pending.chainId, tokenAddresses);

          nativeUsdPrice = priceMap.get("native") ?? null;

          for (const t of simTransfers) {
            if (t.usdValue) continue;
            let price: number | undefined;
            if (!t.tokenAddress) {
              price = nativeUsdPrice ?? undefined;
            } else {
              price = priceMap.get(t.tokenAddress.toLowerCase());
            }
            if (price != null) {
              const val = parseFloat(t.amount) * price;
              t.usdValue = `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }

          transfers = simTransfers.length > 0 ? simTransfers : null;
        } catch (e) {
          _debug.push(`decode/sim CATCH: ${e instanceof Error ? e.message : e}`);
        }
      }

      const mode = await getStorageMode();

      return {
        ok: true,
        data: {
          approval: pending,
          gasPresets,
          account: activeAccount,
          queueSize: getPendingCount(),
          decoded,
          transfers,
          nativeUsdPrice,
          decodedVia,
          simulatedVia,
          hasEtherscanKey,
          hasRpcProviderKey: hasAlchemyKey,
          storageMode: mode,
          _debug,
        },
      };
    }

    case "APPROVE_REQUEST": {
      return executeApproval(message.id, message.gasSpeed, message.password);
    }

    case "REJECT_REQUEST": {
      const rejected = rejectPendingApproval(message.id);
      updateBadge();
      broadcastPendingCount();
      if (!rejected) {
        return { ok: false, error: "No matching pending approval" };
      }
      return { ok: true };
    }

    case "RESET_WALLET": {
      clearAllPending();
      await keychain.deleteMnemonic();
      const meta = await loadAccountsMeta();
      if (meta) {
        await keychain.deleteAllImportedKeys(
          meta.accounts.filter((a) => a.path === "imported").map((a) => a.address),
        );
      }
      await clearVault();
      broadcastEvent("accountsChanged", []);
      broadcastEvent("disconnect", { code: 4900, message: "Wallet reset" });
      return { ok: true };
    }

    case "ESTIMATE_GAS": {
      try {
        const meta = await loadAccountsMeta();
        const fromAddr = meta?.accounts[meta.activeAccountIndex]?.address;
        const presets = await estimateGasPresets(message.chainId, message.tx, fromAddr);
        return { ok: true, data: presets };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Gas estimation failed";
        return { ok: false, error: msg };
      }
    }

    case "GET_ETHERSCAN_KEY": {
      const result = await browser.storage.local.get("etherscanApiKey");
      return {
        ok: true,
        data: { key: (result.etherscanApiKey as string) ?? null },
      };
    }

    case "SET_ETHERSCAN_KEY": {
      if (message.key) {
        await browser.storage.local.set({ etherscanApiKey: message.key });
      } else {
        await browser.storage.local.remove("etherscanApiKey");
      }
      return { ok: true };
    }

    case "GET_RPC_PROVIDER_KEY": {
      const result = await browser.storage.local.get("rpcProviderKey");
      return {
        ok: true,
        data: { key: (result.rpcProviderKey as string) ?? null },
      };
    }

    case "SET_RPC_PROVIDER_KEY": {
      if (message.key) {
        await browser.storage.local.set({ rpcProviderKey: message.key });
        setRpcProviderKeyInMemory(message.key);
      } else {
        await browser.storage.local.remove("rpcProviderKey");
        setRpcProviderKeyInMemory(null);
      }
      return { ok: true };
    }

    case "GET_STORAGE_MODE": {
      const mode = await getStorageMode();
      return { ok: true, data: { storageMode: mode } };
    }

    case "CHECK_KEYCHAIN_AVAILABLE": {
      const probe = await keychain.isKeychainAvailable();
      bgLog("[CHECK_KEYCHAIN_AVAILABLE] probe:", JSON.stringify(probe));
      return { ok: true, data: { available: probe.available, error: probe.error } };
    }

    case "GET_ACTIVITY": {
      const { fetchActivity } = await import("./activity");
      const result = await fetchActivity(message.address, message.chainId, {
        loadMore: message.loadMore === true,
      });
      return { ok: true, data: result };
    }

    case "CLEAR_ACTIVITY_CACHE": {
      const { clearActivityCache } = await import("./activity");
      const { clearAbiCache } = await import("./etherscan");
      await Promise.all([clearActivityCache(), clearAbiCache()]);
      return { ok: true };
    }

    default:
      return { ok: false, error: "Unknown message type" };
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

loadRpcProviderKey().catch(() => {});
bgLog("[background] service worker loaded");
