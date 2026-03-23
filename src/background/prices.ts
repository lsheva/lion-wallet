import { fetchNativePrice } from "./etherscan";

interface CacheEntry {
  prices: Map<string, number>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60_000;

const COINGECKO_PLATFORMS: Record<number, string> = {
  1: "ethereum",
  137: "polygon-pos",
  42161: "arbitrum-one",
  10: "optimistic-ethereum",
  8453: "base",
  56: "binance-smart-chain",
  43114: "avalanche",
};

const COINGECKO_NATIVE_IDS: Record<number, string> = {
  1: "ethereum",
  8453: "ethereum",
  42161: "ethereum",
  10: "ethereum",
  137: "matic-network",
  56: "binancecoin",
  43114: "avalanche-2",
};

const MAX_RETRIES = 3;

async function fetchCoinGeckoPrice(
  platform: string,
  address: string,
): Promise<[string, number] | null> {
  const addr = address.toLowerCase();
  const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${addr}&vs_currencies=usd`;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (!resp.ok) return null;
      const data = (await resp.json()) as Record<string, { usd?: number }>;
      const val = data[addr];
      if (val?.usd != null) return [addr, val.usd];
      return null;
    } catch { /* individual failure is non-critical */ }
  }
  return null;
}

async function fetchCoinGeckoPrices(
  chainId: number,
  tokenAddresses: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const platform = COINGECKO_PLATFORMS[chainId];
  if (!platform || tokenAddresses.length === 0) return result;

  const settled = await Promise.allSettled(
    tokenAddresses.map((a) => fetchCoinGeckoPrice(platform, a)),
  );
  for (const entry of settled) {
    if (entry.status === "fulfilled" && entry.value) {
      result.set(entry.value[0], entry.value[1]);
    }
  }
  return result;
}

export async function fetchPrices(
  _nativeSymbol: string,
  chainId: number,
  tokenAddresses: string[],
): Promise<Map<string, number>> {
  const cacheKey = `${chainId}:${[...tokenAddresses].sort().join(",")}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) return hit.prices;

  const prices = new Map<string, number>();

  const [nativePrice, tokenPrices] = await Promise.allSettled([
    fetchNativePrice(chainId),
    fetchCoinGeckoPrices(chainId, tokenAddresses),
  ]);

  if (nativePrice.status === "fulfilled" && nativePrice.value != null) {
    prices.set("native", nativePrice.value);
  }

  if (tokenPrices.status === "fulfilled") {
    for (const [addr, price] of tokenPrices.value) {
      prices.set(addr, price);
    }
  }

  cache.set(cacheKey, { prices, expiresAt: Date.now() + CACHE_TTL });
  return prices;
}

export async function fetchTokenPrice(chainId: number, address: string): Promise<number | null> {
  const platform = COINGECKO_PLATFORMS[chainId];
  if (!platform) return null;
  const result = await fetchCoinGeckoPrice(platform, address);
  return result ? result[1] : null;
}

/** CoinGecko fallback for native token price (used when Etherscan has no `ethprice` for the chain). */
export async function fetchNativePriceCoinGecko(chainId: number): Promise<number | null> {
  const coinId = COINGECKO_NATIVE_IDS[chainId];
  if (!coinId) return null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      );
      if (resp.status === 429) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (!resp.ok) return null;
      const data = (await resp.json()) as Record<string, { usd?: number }>;
      return data[coinId]?.usd ?? null;
    } catch { /* non-critical */ }
  }
  return null;
}
