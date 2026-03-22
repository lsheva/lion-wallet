import { computed, signal } from "@preact/signals";
import type { ActivityItem, ChainMeta } from "@shared/types";
import { MOCK_ACCOUNTS, MOCK_ACTIVITY, MOCK_TOKENS, NETWORKS, type Token } from "./data";

export type WalletView = "onboarding" | "home" | "approval";

export const currentView = signal<WalletView>("onboarding");
export const activeAccountIndex = signal(0);
export const activeNetworkId = signal(1);
export const showNetworkSelector = signal(false);
export const storageMode = signal<"keychain" | "vault">("keychain");

const MOCK_NETWORK_BY_ID = new Map(NETWORKS.map((n) => [n.id, n]));

export const activeAccount = computed(() => MOCK_ACCOUNTS[activeAccountIndex.value]);
export const activeNetwork = computed(
  () => MOCK_NETWORK_BY_ID.get(activeNetworkId.value) ?? NETWORKS[0],
);

export const accounts = signal(MOCK_ACCOUNTS);
export const tokens = signal<Token[]>(MOCK_TOKENS);
export const networks = signal<ChainMeta[]>(NETWORKS);

export const totalBalanceUsd = computed(() => "$11,306.62");
export const ethBalance = computed(() => "3.4521");
export const nativeUsdPrice = signal<number | null>(2385);
export const activity = signal<ActivityItem[]>(MOCK_ACTIVITY as unknown as ActivityItem[]);
export const activityLoading = signal(false);
export const activitySource = signal<"etherscan" | "rpc" | "cache" | null>("etherscan");
export const activityHasMore = signal(false);

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
    currentView.value = view;
  },
  switchNetwork(id: number) {
    activeNetworkId.value = id;
    showNetworkSelector.value = false;
  },
  switchAccount(index: number) {
    activeAccountIndex.value = index;
  },
  renameAccount(index: number, newName: string) {
    accounts.value = accounts.value.map((acc, i) =>
      i === index ? { ...acc, name: newName } : acc,
    );
  },
  async addAccount(_password?: string) {
    /* dev mock — no-op */
  },
};
