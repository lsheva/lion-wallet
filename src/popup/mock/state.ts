import { signal, computed } from "@preact/signals";
import { MOCK_ACCOUNTS, MOCK_TOKENS, NETWORKS, type Token, type Network } from "./data";

export type WalletView = "onboarding" | "locked" | "home" | "approval";

export const currentView = signal<WalletView>("onboarding");
export const isUnlocked = signal(false);
export const activeAccountIndex = signal(0);
export const activeNetworkId = signal(1);
export const showNetworkSelector = signal(false);

export const activeAccount = computed(() => MOCK_ACCOUNTS[activeAccountIndex.value]);
export const activeNetwork = computed(() =>
  NETWORKS.find((n) => n.id === activeNetworkId.value) ?? NETWORKS[0]
);

export const accounts = signal(MOCK_ACCOUNTS);
export const tokens = signal<Token[]>(MOCK_TOKENS);
export const networks = signal<Network[]>(NETWORKS);

export const totalBalanceUsd = computed(() => "$11,306.62");
export const ethBalance = computed(() => "3.4521");

export const walletState = {
  currentView,
  isUnlocked,
  activeAccountIndex,
  activeNetworkId,
  activeAccount,
  activeNetwork,
  accounts,
  tokens,
  networks,
  totalBalanceUsd,
  ethBalance,
  showNetworkSelector,

  unlock() {
    isUnlocked.value = true;
    currentView.value = "home";
  },
  lock() {
    isUnlocked.value = false;
    currentView.value = "locked";
  },
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
      i === index ? { ...acc, name: newName } : acc
    );
  },
};
