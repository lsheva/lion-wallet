import type { ActivityItem, ChainMeta } from "@shared/types";
import { createMemo, createRoot, createSignal } from "solid-js";
import { MOCK_ACCOUNTS, MOCK_ACTIVITY, MOCK_TOKENS, NETWORKS, type Token } from "./data";

export type WalletView = "onboarding" | "home" | "approval";

export const [currentView, setCurrentView] = createSignal<WalletView>("onboarding");
export const [activeAccountIndex, setActiveAccountIndex] = createSignal(0);
export const [activeNetworkId, setActiveNetworkId] = createSignal(1);
export const [showNetworkSelector, setShowNetworkSelector] = createSignal(false);
export const [storageMode, setStorageMode] = createSignal<"keychain" | "vault">("keychain");

const MOCK_NETWORK_BY_ID = new Map(NETWORKS.map((n) => [n.id, n]));

const mockDerived = createRoot(() => {
  const activeAccount = createMemo(() => MOCK_ACCOUNTS[activeAccountIndex()]);
  const activeNetwork = createMemo(() => MOCK_NETWORK_BY_ID.get(activeNetworkId()) ?? NETWORKS[0]);
  return { activeAccount, activeNetwork };
});

export const { activeAccount, activeNetwork } = mockDerived;

export const [accounts, setAccounts] = createSignal(MOCK_ACCOUNTS);
export const [tokens, setTokens] = createSignal<Token[]>(MOCK_TOKENS);
export const [networks, setNetworks] = createSignal<ChainMeta[]>(NETWORKS);

export const totalBalanceUsd = createRoot(() => createMemo(() => "$11,306.62"));
export const [ethBalance] = createSignal("3.4521");
export const [nativeUsdPrice, setNativeUsdPrice] = createSignal<number | null>(2385);
export const [activity, setActivity] = createSignal<ActivityItem[]>(
  MOCK_ACTIVITY as unknown as ActivityItem[],
);
export const [activityLoading, setActivityLoading] = createSignal(false);
export const [activitySource, setActivitySource] = createSignal<
  "etherscan" | "rpc" | "cache" | null
>("etherscan");
export const [activityHasMore, setActivityHasMore] = createSignal(false);

export const walletState = {
  currentView,
  activeAccountIndex,
  activeNetworkId,
  activeAccount,
  activeNetwork,
  accounts,
  tokens,
  networks,
  totalBalanceUsd,
  ethBalance,
  nativeUsdPrice,
  showNetworkSelector,
  storageMode,
  activity,
  activityLoading,
  activitySource,
  activityHasMore,

  setView(view: WalletView) {
    setCurrentView(view);
  },
  switchNetwork(id: number) {
    setActiveNetworkId(id);
    setShowNetworkSelector(false);
  },
  switchAccount(index: number) {
    setActiveAccountIndex(index);
  },
  renameAccount(index: number, newName: string) {
    setAccounts(accounts().map((acc, i) => (i === index ? { ...acc, name: newName } : acc)));
  },
  async addAccount(_password?: string) {
    /* dev mock — no-op */
  },
};
