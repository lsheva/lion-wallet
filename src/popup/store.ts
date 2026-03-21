import { computed, signal } from "@preact/signals";
import { CHAINS } from "@shared/constants";
import { formatUsd } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { ActivityItem, ChainMeta, SerializedAccount, TokenInfo } from "@shared/types";
import type { Address } from "viem";
import { CHAIN_COLOR_BY_ID } from "./chain-ui.generated";

export type { ActivityItem, TokenInfo as Token };

const DEFAULT_COLOR = "#8E8E93";

export const accounts = signal<SerializedAccount[]>([]);
export const activeAccountIndex = signal(0);
export const activeNetworkId = signal(1);
export const showNetworkSelector = signal(false);
export const ethBalance = signal("0");
/** Per-unit native token USD price; `0` on testnets; `null` if unavailable. */
export const nativeUsdPrice = signal<number | null>(null);
export const tokens = signal<TokenInfo[]>([]);
export const networks = signal<ChainMeta[]>(CHAINS);
export const storageMode = signal<"keychain" | "vault">("vault");

export const activeAccount = computed(
  () =>
    accounts.value[activeAccountIndex.value] ?? {
      name: "Account 1",
      address: "0x0000000000000000000000000000000000000000" as Address,
      path: "m/44'/60'/0'/0/0",
      index: 0,
    },
);

const networkMap = computed(() => new Map(networks.value.map((n) => [n.id, n])));

export const activeNetwork = computed(
  () => networkMap.value.get(activeNetworkId.value) ?? (networks.value[0] as ChainMeta),
);

export function chainColor(chainId: number): string {
  return CHAIN_COLOR_BY_ID.get(chainId) ?? DEFAULT_COLOR;
}

function nativeBalanceUsdString(): string | undefined {
  const rate = nativeUsdPrice.peek();
  const bal = parseFloat(ethBalance.peek());
  if (Number.isNaN(bal) || rate == null) return undefined;
  if (rate === 0) return formatUsd(0);
  if (rate > 0) return formatUsd(bal * rate);
  return undefined;
}

function buildNativeToken(): TokenInfo {
  const net = activeNetwork.peek();
  return {
    symbol: net.nativeCurrency.symbol,
    name: net.nativeCurrency.name,
    decimals: net.nativeCurrency.decimals,
    balance: ethBalance.peek(),
    color: chainColor(net.id),
    usdValue: nativeBalanceUsdString(),
  };
}

export async function fetchState(): Promise<void> {
  const res = await sendMessage({ type: "GET_STATE" });
  if (!res.ok || !res.data) return;
  accounts.value = res.data.accounts;
  activeAccountIndex.value = res.data.activeAccountIndex;
  activeNetworkId.value = res.data.activeNetworkId;
  storageMode.value = res.data.storageMode;
}

export async function fetchBalance(): Promise<void> {
  const account = activeAccount.peek();
  if (!account.address || account.address === "0x0000000000000000000000000000000000000000") return;
  const res = await sendMessage({
    type: "GET_BALANCE",
    address: account.address as Address,
    chainId: activeNetworkId.peek(),
  });
  if (res.ok && res.data) {
    ethBalance.value = res.data.balance;
    nativeUsdPrice.value = res.data.nativeUsdPrice;
    tokens.value = [buildNativeToken(), ...tokens.value.filter((t) => t.address)];
  }
}

export const activity = signal<ActivityItem[]>([]);
export const activityLoading = signal(false);
export const activitySource = signal<"etherscan" | "rpc" | "cache" | null>(null);
export const activityHasMore = signal(false);

export async function fetchActivity(options?: { loadMore?: boolean }): Promise<void> {
  const account = activeAccount.peek();
  if (!account.address || account.address === "0x0000000000000000000000000000000000000000") return;
  activityLoading.value = true;
  try {
    const res = await sendMessage({
      type: "GET_ACTIVITY",
      address: account.address as Address,
      chainId: activeNetworkId.peek(),
      ...(options?.loadMore ? { loadMore: true } : {}),
    });
    if (res.ok && res.data) {
      activity.value = res.data.items;
      activitySource.value = res.data.source;
      activityHasMore.value = res.data.hasMore;
    }
  } catch {
    /* non-blocking — keep whatever was in the signal */
  } finally {
    activityLoading.value = false;
  }
}

export async function refreshAll(): Promise<void> {
  await fetchState();
  await fetchBalance();
}

export const walletState = {
  activeAccount,
  activeNetwork,
  activeAccountIndex,
  activeNetworkId,
  accounts,
  tokens,
  networks,
  ethBalance,
  nativeUsdPrice,
  showNetworkSelector,
  storageMode,
  activity,
  activityLoading,
  activitySource,
  activityHasMore,

  async switchNetwork(id: number): Promise<void> {
    activeNetworkId.value = id;
    showNetworkSelector.value = false;
    try {
      await sendMessage({ type: "SWITCH_NETWORK", chainId: id });
    } catch (e) {
      console.warn("[store] switchNetwork message failed:", e);
    }
    await fetchBalance();
  },

  async switchAccount(index: number): Promise<void> {
    activeAccountIndex.value = index;
    try {
      await sendMessage({ type: "SWITCH_ACCOUNT", accountIndex: index });
    } catch (e) {
      console.warn("[store] switchAccount message failed:", e);
    }
    await fetchBalance();
  },

  renameAccount(index: number, newName: string) {
    accounts.value = accounts.value.map((acc, i) =>
      i === index ? { ...acc, name: newName } : acc,
    );
  },

  async addAccount(password?: string): Promise<void> {
    const res = await sendMessage({
      type: "ADD_ACCOUNT",
      ...(password ? { password } : {}),
    });
    if (res.ok) {
      await fetchState();
    }
  },
};
