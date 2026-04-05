import type { ActivityItem, ChainMeta, KeyringPublic } from "@shared/types";
import { createMemo, createRoot, createSignal } from "solid-js";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import {
  DEV_MOCK_KEYRINGS,
  MOCK_ACCOUNTS,
  MOCK_ACTIVITY,
  MOCK_TOKENS,
  NETWORKS,
  type Token,
} from "./data";

export type WalletView = "onboarding" | "home" | "approval";

export const [currentView, setCurrentView] = createSignal<WalletView>("onboarding");
export const [activeAccountAddress, setActiveAccountAddress] = createSignal<Address>(
  (MOCK_ACCOUNTS[0]?.address ?? zeroAddress) as Address,
);
export const [keyrings, setKeyrings] = createSignal<KeyringPublic[]>(DEV_MOCK_KEYRINGS);
export const [activeNetworkId, setActiveNetworkId] = createSignal(1);
export const [showNetworkSelector, setShowNetworkSelector] = createSignal(false);
export const [storageMode, setStorageMode] = createSignal<"keychain" | "vault">("keychain");

export const [accounts, setAccounts] = createSignal(MOCK_ACCOUNTS);

const MOCK_NETWORK_BY_ID = new Map(NETWORKS.map((n) => [n.id, n]));

const mockDerived = createRoot(() => {
  const activeAccountIndex = createMemo(() =>
    accounts().findIndex(
      (a) => a.address.toLowerCase() === activeAccountAddress().toLowerCase(),
    ),
  );
  const activeAccount = createMemo(
    () =>
      accounts().find((a) => a.address.toLowerCase() === activeAccountAddress().toLowerCase()) ??
      accounts()[0],
  );
  const activeNetwork = createMemo(() => MOCK_NETWORK_BY_ID.get(activeNetworkId()) ?? NETWORKS[0]);
  return { activeAccount, activeNetwork, activeAccountIndex };
});

export const { activeAccount, activeNetwork, activeAccountIndex } = mockDerived;

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

export function homeAccountsForSwitcher(): {
  account: (typeof MOCK_ACCOUNTS)[0];
  accountArrayIndex: number;
}[] {
  return accounts().map((account, accountArrayIndex) => ({ account, accountArrayIndex }));
}

export const walletState = {
  currentView,
  activeAccountIndex,
  activeAccountAddress,
  keyrings,
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
  homeAccountsForSwitcher,

  setView(view: WalletView) {
    setCurrentView(view);
  },
  switchNetwork(id: number) {
    setActiveNetworkId(id);
    setShowNetworkSelector(false);
  },
  switchAccount(index: number) {
    const acc = accounts()[index];
    if (acc) setActiveAccountAddress(acc.address as Address);
  },
  renameAccount(index: number, newName: string) {
    setAccounts(accounts().map((acc, i) => (i === index ? { ...acc, name: newName } : acc)));
  },
  async addAccount(_password?: string) {
    /* dev mock — no-op */
  },
};
