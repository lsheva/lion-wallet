/**
 * Persistent caches the popup keeps in `localStorage`. All accessors swallow
 * errors so a corrupt or quota-exceeded localStorage never crashes the popup.
 */
import { CHAINS } from "@shared/constants";
import type { ChainMeta } from "@shared/types";
import { defineLocalStore } from "../lib/local-cache";

export const POPULAR_CHAIN_IDS = new Set([
  1, // Ethereum
  8453, // Base
  42161, // Arbitrum One
  137, // Polygon
  10, // OP Mainnet
  56, // BNB Smart Chain
  43114, // Avalanche
]);

const NATIVE_BALANCE_KEY = "nativeBalanceCache";
const NETWORK_IDS_KEY = "userNetworkIds";
const TOKEN_PRICES_KEY = "tokenPricesCache";

const networkIdsStore = defineLocalStore<number[] | null>(NETWORK_IDS_KEY, null);

export function loadSavedNetworkIds(): number[] | null {
  return networkIdsStore.get();
}

export function saveNetworkIds(chains: ChainMeta[]): void {
  networkIdsStore.set(chains.map((c) => c.id));
}

export interface NativeBalanceCache {
  balance: string;
  usdPrice: number | null;
}

const nativeBalanceStore = defineLocalStore<Record<string, NativeBalanceCache>>(
  NATIVE_BALANCE_KEY,
  {},
);

function nativeBalanceCacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export function loadNativeBalanceCache(
  chainId: number,
  address: string,
): NativeBalanceCache | null {
  return nativeBalanceStore.get()[nativeBalanceCacheKey(chainId, address)] ?? null;
}

export function saveNativeBalanceCache(
  chainId: number,
  address: string,
  balance: string,
  usdPrice: number | null,
): void {
  nativeBalanceStore.patch((all) => ({
    ...all,
    [nativeBalanceCacheKey(chainId, address)]: { balance, usdPrice },
  }));
}

const tokenPricesStore = defineLocalStore<Record<number, Record<string, number>>>(
  TOKEN_PRICES_KEY,
  {},
);

export function loadTokenPrices(chainId: number): Record<string, number> {
  return tokenPricesStore.get()[chainId] ?? {};
}

export function saveTokenPrices(chainId: number, prices: Record<string, number>): void {
  tokenPricesStore.patch((all) => ({
    ...all,
    [chainId]: { ...(all[chainId] ?? {}), ...prices },
  }));
}

/** Wipe every popup-side cache. Called on `clearPopupCache()` and wallet reset. */
export function resetAllLocalCaches(): void {
  networkIdsStore.remove();
  nativeBalanceStore.remove();
  tokenPricesStore.remove();
}

export function buildInitialNetworks(): ChainMeta[] {
  const saved = loadSavedNetworkIds();
  if (saved) {
    const byId = new Map(CHAINS.map((c) => [c.id, c]));
    const known = saved.map((id) => byId.get(id)).filter(Boolean) as ChainMeta[];
    return known.length > 0 ? known : CHAINS.filter((c) => POPULAR_CHAIN_IDS.has(c.id));
  }
  return CHAINS.filter((c) => POPULAR_CHAIN_IDS.has(c.id));
}

/** Parse a USD-formatted string back to a number for sums/sorting. */
export function parseUsdValue(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}
