import { CHAINS } from "@shared/constants";
import { formatUsd } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type {
  ActivityItem,
  ChainMeta,
  SerializedAccount,
  StoredToken,
  TokenInfo,
} from "@shared/types";
import { batch, createMemo, createRoot, createSignal, untrack } from "solid-js";
import type { Address } from "viem";
import { formatUnits } from "viem/utils";
import { CHAIN_COLOR_BY_ID } from "./chain-ui.generated";

export type { ActivityItem, TokenInfo as Token };

const DEFAULT_COLOR = "#8E8E93";

export const [accounts, setAccounts] = createSignal<SerializedAccount[]>([]);
export const [activeAccountIndex, setActiveAccountIndex] = createSignal(0);
export const [activeNetworkId, setActiveNetworkId] = createSignal(1);
export const [showNetworkSelector, setShowNetworkSelector] = createSignal(false);
export const [ethBalance, setEthBalance] = createSignal("0");
/** Per-unit native token USD price; `0` on testnets; `null` if unavailable. */
export const [nativeUsdPrice, setNativeUsdPrice] = createSignal<number | null>(null);
export const [tokens, setTokens] = createSignal<TokenInfo[]>([]);
export const [networks, setNetworks] = createSignal<ChainMeta[]>(CHAINS);
export const [storageMode, setStorageMode] = createSignal<"keychain" | "vault">("vault");

const derived = createRoot(() => {
  const activeAccount = createMemo(
    () =>
      accounts()[activeAccountIndex()] ?? {
        name: "Account 1",
        address: "0x0000000000000000000000000000000000000000" as Address,
        path: "m/44'/60'/0'/0/0",
        index: 0,
      },
  );

  const networkMap = createMemo(() => new Map(networks().map((n) => [n.id, n])));

  const activeNetwork = createMemo(
    () => networkMap().get(activeNetworkId()) ?? (networks()[0] as ChainMeta),
  );

  return { activeAccount, activeNetwork };
});

export const { activeAccount, activeNetwork } = derived;

export function chainColor(chainId: number): string {
  return CHAIN_COLOR_BY_ID.get(chainId) ?? DEFAULT_COLOR;
}

function nativeBalanceUsdString(): string | undefined {
  const rate = untrack(nativeUsdPrice);
  const bal = parseFloat(untrack(ethBalance));
  if (Number.isNaN(bal) || rate == null) return undefined;
  if (rate === 0) return formatUsd(0);
  if (rate > 0) return formatUsd(bal * rate);
  return undefined;
}

function buildNativeToken(): TokenInfo {
  const net = untrack(activeNetwork);
  return {
    symbol: net.nativeCurrency.symbol,
    name: net.nativeCurrency.name,
    decimals: net.nativeCurrency.decimals,
    balance: untrack(ethBalance),
    color: chainColor(net.id),
    usdValue: nativeBalanceUsdString(),
  };
}

export async function fetchState(): Promise<void> {
  const res = await sendMessage({ type: "GET_STATE" });
  if (!res.ok || !res.data) return;
  batch(() => {
    setAccounts(res.data.accounts);
    setActiveAccountIndex(res.data.activeAccountIndex);
    setActiveNetworkId(res.data.activeNetworkId);
    setStorageMode(res.data.storageMode);
  });
}

export async function fetchBalance(): Promise<void> {
  const account = untrack(activeAccount);
  if (!account.address || account.address === "0x0000000000000000000000000000000000000000") return;
  const chainId = untrack(activeNetworkId);
  const address = account.address as Address;

  const res = await sendMessage({
    type: "GET_BALANCE",
    address,
    chainId,
  });
  if (res.ok && res.data) {
    batch(() => {
      setEthBalance(res.data.balance);
      setNativeUsdPrice(res.data.nativeUsdPrice);
      setTokens([buildNativeToken()]);
    });
  }

  loadDiscoveredTokens(chainId, address);

  sendMessage({ type: "SCAN_TOKENS", chainId, address }).catch(() => {});
}

async function loadDiscoveredTokens(chainId: number, walletAddress?: Address): Promise<void> {
  const addr = walletAddress ?? (untrack(activeAccount).address as Address);
  try {
    const res = await sendMessage({ type: "GET_DISCOVERED_TOKENS", chainId, walletAddress: addr });
    if (!res.ok || !res.data?.tokens?.length) return;

    const discovered: StoredToken[] = res.data.tokens;
    const tokenAddresses = discovered.map((t) => t.address as Address);

    const balRes = await sendMessage({ type: "GET_TOKEN_BALANCES", tokens: tokenAddresses });
    const balances: Record<string, string> = balRes.ok && balRes.data ? balRes.data.balances : {};

    const erc20Tokens: TokenInfo[] = discovered.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      address: t.address as Address,
      decimals: t.decimals,
      balance: formatBalance(balances[t.address as Address] ?? "0", t.decimals),
      color: chainColor(chainId),
      source: t.source,
    }));

    batch(() => {
      const native = untrack(tokens).find((t) => !t.address);
      setTokens([...(native ? [native] : [buildNativeToken()]), ...erc20Tokens]);
    });
  } catch {
    /* non-critical — keep native-only list */
  }
}

function formatBalance(raw: string, decimals: number): string {
  try {
    return formatUnits(BigInt(raw), decimals);
  } catch {
    return "0";
  }
}

export function parseUsdValue(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export async function hideToken(tokenAddress: Address): Promise<void> {
  const chainId = untrack(activeNetworkId);
  const walletAddress = untrack(activeAccount).address as Address;
  try {
    await sendMessage({ type: "HIDE_DISCOVERED_TOKEN", chainId, walletAddress, address: tokenAddress });
    setTokens(untrack(tokens).filter((t) => t.address !== tokenAddress));
  } catch {
    /* non-critical */
  }
}

export const [activity, setActivity] = createSignal<ActivityItem[]>([]);
export const [activityLoading, setActivityLoading] = createSignal(false);
export const [activitySource, setActivitySource] = createSignal<
  "etherscan" | "rpc" | "cache" | null
>(null);
export const [activityHasMore, setActivityHasMore] = createSignal(false);

export async function fetchActivity(options?: { loadMore?: boolean }): Promise<void> {
  const account = untrack(activeAccount);
  if (!account.address || account.address === "0x0000000000000000000000000000000000000000") return;
  setActivityLoading(true);
  try {
    const res = await sendMessage({
      type: "GET_ACTIVITY",
      address: account.address as Address,
      chainId: untrack(activeNetworkId),
      ...(options?.loadMore ? { loadMore: true } : {}),
    });
    if (res.ok && res.data) {
      batch(() => {
        setActivity(res.data.items);
        setActivitySource(res.data.source);
        setActivityHasMore(res.data.hasMore);
      });
    }
  } catch {
    /* non-blocking — keep whatever was in the signal */
  } finally {
    setActivityLoading(false);
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
    setActiveNetworkId(id);
    setShowNetworkSelector(false);
    batch(() => {
      setActivity([]);
      setActivitySource(null);
      setActivityHasMore(false);
    });
    try {
      await sendMessage({ type: "SWITCH_NETWORK", chainId: id });
    } catch (e) {
      console.warn("[store] switchNetwork message failed:", e);
    }
    await fetchBalance();
    fetchActivity().catch(() => {});
  },

  async switchAccount(index: number): Promise<void> {
    setActiveAccountIndex(index);
    try {
      await sendMessage({ type: "SWITCH_ACCOUNT", accountIndex: index });
    } catch (e) {
      console.warn("[store] switchAccount message failed:", e);
    }
    await fetchBalance();
  },

  renameAccount(index: number, newName: string) {
    setAccounts(accounts().map((acc, i) => (i === index ? { ...acc, name: newName } : acc)));
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
