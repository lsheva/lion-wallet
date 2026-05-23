/**
 * Popup store barrel.
 *
 * Each domain has its own module (cache, network, accounts, balance,
 * activity). This file re-exports the common surface and assembles the
 * `walletState` god-object that the rest of the popup historically imports
 * from `@/store`. New code should prefer named imports per concern, e.g.
 * `import { activeAccount } from "@/store/accounts"`.
 *
 * Cross-domain orchestration (switch network → refetch balance + activity,
 * switch account → refetch balance, full refresh, cache wipe) lives here so
 * the per-domain modules stay free of import cycles.
 */
import { CHAINS } from "@shared/constants";
import { toErrorMessage } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { TokenInfo } from "@shared/types";
import { batch, untrack } from "solid-js";
import { zeroAddress } from "viem";
import { showError } from "../toast";
import {
  accounts,
  activeAccount,
  activeAccountAddress,
  activeAccountIndex,
  addAccount,
  addKeyringCreate,
  addKeyringImport,
  chainDiscoveryScanning,
  deleteKeyring,
  deriveInKeyring,
  ensureChainDiscoveryForChain,
  fetchState,
  homeAccountsForSwitcher,
  homeDiscoveryActiveIndices,
  importPrivateKey,
  keyrings,
  removeAccount,
  renameAccount,
  renameKeyring,
  setAccounts,
  setActiveAccountAddress,
  setChainDiscoveryScanning,
  setHomeDiscoveryActiveIndices,
  setKeyrings,
  setStorageMode,
  storageMode,
} from "./accounts";
import {
  activity,
  activityHasMore,
  activityLoading,
  activitySource,
  fetchActivity,
  setActivity,
  setActivityHasMore,
  setActivitySource,
} from "./activity";
import {
  balanceLoading,
  buildNativeToken,
  ethBalance,
  fetchBalance,
  hideToken,
  nativeUsdPrice,
  setBalanceLoading,
  setEthBalance,
  setNativeUsdPrice,
  setTokens,
  tokens,
} from "./balance";
import { loadNativeBalanceCache, POPULAR_CHAIN_IDS, resetAllLocalCaches } from "./cache";
import {
  ALL_CHAINS,
  activeNetwork,
  activeNetworkId,
  chainColor,
  networks,
  setActiveNetworkId,
  setNetworks,
  setRawNetworks,
  setShowNetworkSelector,
  showNetworkSelector,
} from "./network";

// ── Re-exports (legacy `from "@/store"` surface) ─────────────────────

export type { ActivityItem } from "./activity";
export { parseUsdValue } from "./cache";
export type { TokenInfo as Token };
export {
  // network
  ALL_CHAINS,
  // accounts
  accounts,
  activeAccount,
  activeAccountAddress,
  activeAccountIndex,
  activeNetwork,
  activeNetworkId,
  // activity
  activity,
  activityHasMore,
  activityLoading,
  activitySource,
  balanceLoading,
  chainColor,
  chainDiscoveryScanning,
  // balance
  ethBalance,
  fetchActivity,
  fetchBalance,
  fetchState,
  hideToken,
  homeAccountsForSwitcher,
  homeDiscoveryActiveIndices,
  keyrings,
  nativeUsdPrice,
  networks,
  setAccounts,
  setActiveAccountAddress,
  setActiveNetworkId,
  setActivity,
  setActivityHasMore,
  setActivitySource,
  setBalanceLoading,
  setChainDiscoveryScanning,
  setEthBalance,
  setHomeDiscoveryActiveIndices,
  setKeyrings,
  setNativeUsdPrice,
  setNetworks,
  setShowNetworkSelector,
  setStorageMode,
  setTokens,
  showNetworkSelector,
  storageMode,
  tokens,
};

// ── Orchestrator actions ──────────────────────────────────────────────

/** Wipe every popup-side cache and reset signals to their initial values. */
export function clearPopupCache(): void {
  resetAllLocalCaches();
  batch(() => {
    setAccounts([]);
    setKeyrings([]);
    setActiveAccountAddress(zeroAddress);
    setActiveNetworkId(1);
    setEthBalance("—");
    setNativeUsdPrice(null);
    setTokens([]);
    setBalanceLoading(true);
    setRawNetworks(CHAINS.filter((c) => POPULAR_CHAIN_IDS.has(c.id)));
    setActivity([]);
    setActivitySource(null);
    setActivityHasMore(false);
    setHomeDiscoveryActiveIndices(null);
    setChainDiscoveryScanning(false);
  });
}

export async function refreshAll(): Promise<void> {
  await fetchState();
  await ensureChainDiscoveryForChain(activeNetworkId());
  await fetchBalance();
}

async function switchNetworkAction(id: number): Promise<void> {
  setActiveNetworkId(id);
  setShowNetworkSelector(false);
  const cached = loadNativeBalanceCache(id, untrack(activeAccount).address);
  batch(() => {
    setActivity([]);
    setActivitySource(null);
    setActivityHasMore(false);
    setEthBalance(cached?.balance ?? "—");
    setNativeUsdPrice(cached?.usdPrice ?? null);
  });
  setTokens([buildNativeToken()]);
  try {
    await sendMessage({ type: "SWITCH_NETWORK", chainId: id });
  } catch (e) {
    showError("Failed to switch network", toErrorMessage(e));
    return;
  }
  await ensureChainDiscoveryForChain(id);
  await fetchBalance();
  fetchActivity().catch(() => {});
}

async function switchAccountAction(index: number): Promise<void> {
  const acc = accounts()[index];
  if (!acc) return;
  setActiveAccountAddress(acc.address);
  try {
    await sendMessage({ type: "SWITCH_ACCOUNT", activeAccountAddress: acc.address });
  } catch (e) {
    showError("Failed to switch account", toErrorMessage(e));
  }
  await fetchBalance();
}

/**
 * Aggregate API kept for backward compatibility. Prefer named imports from
 * specific submodules in new code; this object exists so existing
 * `walletState.foo()` call sites keep working unchanged.
 */
export const walletState = {
  activeAccount,
  activeNetwork,
  activeAccountIndex,
  activeAccountAddress,
  keyrings,
  activeNetworkId,
  accounts,
  homeDiscoveryActiveIndices,
  chainDiscoveryScanning,
  homeAccountsForSwitcher,
  tokens,
  networks,
  ethBalance,
  nativeUsdPrice,
  balanceLoading,
  showNetworkSelector,
  storageMode,
  activity,
  activityLoading,
  activitySource,
  activityHasMore,

  async refreshChainDiscovery(): Promise<void> {
    await ensureChainDiscoveryForChain(untrack(activeNetworkId));
    await fetchBalance();
    fetchActivity().catch(() => {});
  },

  switchNetwork: switchNetworkAction,
  switchAccount: switchAccountAction,
  renameAccount,
  addAccount,
  deriveInKeyring,
  importPrivateKey,
  addKeyringCreate,
  addKeyringImport,
  renameKeyring,
  deleteKeyring,
  removeAccount,
};
