import { fetchNativePrice } from "./etherscan";
import { bgLog } from "./log";

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

async function fetchCoinGeckoPrices(
  chainId: number,
  tokenAddresses: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const platform = COINGECKO_PLATFORMS[chainId];
  if (!platform || tokenAddresses.length === 0) return result;

  try {
    const addresses = tokenAddresses.map((a) => a.toLowerCase()).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${addresses}&vs_currencies=usd`;
    const resp = await fetch(url);
    if (!resp.ok) return result;
    const data = (await resp.json()) as Record<string, { usd?: number }>;
    for (const [addr, val] of Object.entries(data)) {
      if (val.usd != null) {
        result.set(addr.toLowerCase(), val.usd);
      }
    }
  } catch (e) {
    bgLog("[prices] CoinGecko fetch failed:", e);
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
