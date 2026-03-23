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
import { type Address, zeroAddress } from "viem";
import { formatUnits } from "viem/utils";
import { CHAIN_COLOR_BY_ID } from "./chain-ui.generated";

export type { ActivityItem, TokenInfo as Token };

const DEFAULT_COLOR = "#8E8E93";

const POPULAR_CHAIN_IDS = new Set([
  1, // Ethereum
  8453, // Base
  42161, // Arbitrum One
  137, // Polygon
  10, // OP Mainnet
  56, // BNB Smart Chain
  43114, // Avalanche
]);

const NETWORK_IDS_KEY = "userNetworkIds";

function loadSavedNetworkIds(): number[] | null {
  try {
    const raw = localStorage.getItem(NETWORK_IDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveNetworkIds(chains: ChainMeta[]): void {
  localStorage.setItem(NETWORK_IDS_KEY, JSON.stringify(chains.map((c) => c.id)));
}

function buildInitialNetworks(): ChainMeta[] {
  const saved = loadSavedNetworkIds();
  if (saved) {
    const byId = new Map(CHAINS.map((c) => [c.id, c]));
    const known = saved.map((id) => byId.get(id)).filter(Boolean) as ChainMeta[];
    return known.length > 0 ? known : CHAINS.filter((c) => POPULAR_CHAIN_IDS.has(c.id));
  }
  return CHAINS.filter((c) => POPULAR_CHAIN_IDS.has(c.id));
}

export const ALL_CHAINS = CHAINS;

export const [accounts, setAccounts] = createSignal<SerializedAccount[]>([]);
export const [activeAccountIndex, setActiveAccountIndex] = createSignal(0);
export const [activeNetworkId, setActiveNetworkId] = createSignal(1);
export const [showNetworkSelector, setShowNetworkSelector] = createSignal(false);
export const [ethBalance, setEthBalance] = createSignal("0");
/** Per-unit native token USD price; `0` on testnets; `null` if unavailable. */
export const [nativeUsdPrice, setNativeUsdPrice] = createSignal<number | null>(null);
export const [tokens, setTokens] = createSignal<TokenInfo[]>([]);
export const [balanceLoading, setBalanceLoading] = createSignal(false);
export const [networks, setRawNetworks] = createSignal<ChainMeta[]>(buildInitialNetworks());
export const [storageMode, setStorageMode] = createSignal<"keychain" | "vault">("vault");

export function setNetworks(chains: ChainMeta[]): void {
  setRawNetworks(chains);
  saveNetworkIds(chains);
}

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
  if (Number.isNaN(bal) || rate == null) return "\u2014";
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
  if (!account.address || account.address === zeroAddress) return;
  const chainId = untrack(activeNetworkId);
  const address = account.address as Address;
  setBalanceLoading(true);

  // Phase 1: show cached token list immediately (storage read, no RPC)
  const discoveredRes = await sendMessage({
    type: "GET_DISCOVERED_TOKENS",
    chainId,
    walletAddress: address,
  }).catch(() => null);

  const discovered: StoredToken[] =
    discoveredRes?.ok && discoveredRes.data?.tokens?.length ? discoveredRes.data.tokens : [];

  if (discovered.length > 0) {
    const cached: TokenInfo[] = discovered.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      address: t.address as Address,
      decimals: t.decimals,
      balance: t.lastBalance ? formatBalance(t.lastBalance, t.decimals) : "\u2014",
      color: chainColor(chainId),
      source: t.source,
    }));
    setTokens([buildNativeToken(), ...cached]);
  }

  // Phase 2: fetch real balances (native + ERC-20 in parallel)
  const tokenAddresses = discovered.map((t) => t.address as Address);
  const [balRes, tokBalRes] = await Promise.all([
    sendMessage({ type: "GET_BALANCE", address, chainId }),
    tokenAddresses.length > 0
      ? sendMessage({ type: "GET_TOKEN_BALANCES", tokens: tokenAddresses })
      : null,
  ]);

  if (balRes.ok && balRes.data) {
    setEthBalance(balRes.data.balance);
    setNativeUsdPrice(balRes.data.nativeUsdPrice);
  }

  const balances: Record<string, string> =
    tokBalRes?.ok && tokBalRes.data ? tokBalRes.data.balances : {};
  const erc20Tokens: TokenInfo[] = discovered.map((t) => ({
    symbol: t.symbol,
    name: t.name,
    address: t.address as Address,
    decimals: t.decimals,
    balance: formatBalance(balances[t.address as Address] ?? "0", t.decimals),
    color: chainColor(chainId),
    source: t.source,
  }));

  setTokens([buildNativeToken(), ...erc20Tokens]);

  // Phase 3: scan for new tokens; if any found, fetch their balances and append
  try {
    const scanRes = await sendMessage({ type: "SCAN_TOKENS", chainId, address });
    if (scanRes.ok && scanRes.data?.found > 0) {
      const freshRes = await sendMessage({
        type: "GET_DISCOVERED_TOKENS",
        chainId,
        walletAddress: address,
      }).catch(() => null);
      if (freshRes?.ok && freshRes.data?.tokens?.length) {
        const existingAddrs = new Set(discovered.map((d) => d.address));
        const newTokens: StoredToken[] = freshRes.data.tokens.filter(
          (t: StoredToken) => !existingAddrs.has(t.address),
        );
        if (newTokens.length > 0) {
          const newAddresses = newTokens.map((t) => t.address as Address);
          const newBalRes = await sendMessage({ type: "GET_TOKEN_BALANCES", tokens: newAddresses });
          const newBals: Record<string, string> =
            newBalRes.ok && newBalRes.data ? newBalRes.data.balances : {};
          const additions: TokenInfo[] = newTokens.map((t) => ({
            symbol: t.symbol,
            name: t.name,
            address: t.address as Address,
            decimals: t.decimals,
            balance: formatBalance(newBals[t.address as Address] ?? "0", t.decimals),
            color: chainColor(chainId),
            source: t.source,
          }));
          setTokens((prev) => [...prev, ...additions]);
        }
      }
    }
  } catch {
    /* non-critical */
  } finally {
    setBalanceLoading(false);
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
    await sendMessage({
      type: "HIDE_DISCOVERED_TOKEN",
      chainId,
      walletAddress,
      address: tokenAddress,
    });
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
  balanceLoading,
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
      setEthBalance("\u2014");
      setNativeUsdPrice(null);
    });
    setTokens([buildNativeToken()]);
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
