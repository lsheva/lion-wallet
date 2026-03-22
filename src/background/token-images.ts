import { getAddress } from "viem/utils";

const CACHE_NAME = "token-logos";
const MAX_ENTRIES = 500;
const MISS_RETRY_MS = 24 * 60 * 60 * 1000;
const MISS_HEADER = "x-miss";
const LRU_KEY = "tokenLogosLru";

const CHAIN_SLUG: Record<number, string> = {
  1: "ethereum",
  137: "polygon",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  56: "smartchain",
  43114: "avalanchec",
  250: "fantom",
  100: "xdai",
  324: "zksync",
};

function cdnUrl(chainId: number, address: string): string | null {
  const slug = CHAIN_SLUG[chainId];
  if (!slug) return null;
  const checksummed = getAddress(address as `0x${string}`);
  return `https://raw.githubusercontent.com/niconiahi/trustwallet-assets/master/blockchains/${slug}/assets/${checksummed}/logo.png`;
}

async function loadLru(): Promise<string[]> {
  try {
    const stored = await browser.storage.local.get(LRU_KEY);
    return Array.isArray(stored[LRU_KEY]) ? stored[LRU_KEY] : [];
  } catch {
    return [];
  }
}

async function saveLru(lru: string[]): Promise<void> {
  try {
    await browser.storage.local.set({ [LRU_KEY]: lru });
  } catch {
    /* non-critical */
  }
}

async function touchLru(url: string): Promise<void> {
  const lru = await loadLru();
  const idx = lru.indexOf(url);
  if (idx !== -1) lru.splice(idx, 1);
  lru.push(url);
  await saveLru(lru);
}

async function evictIfNeeded(cache: Cache): Promise<void> {
  const lru = await loadLru();
  if (lru.length <= MAX_ENTRIES) return;

  const toEvict = lru.splice(0, lru.length - MAX_ENTRIES);
  await Promise.all(toEvict.map((url) => cache.delete(url)));
  await saveLru(lru);
}

export async function getTokenImage(chainId: number, address: string): Promise<string | null> {
  const url = cdnUrl(chainId, address);
  if (!url) return null;

  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url);

  if (cached) {
    const isMiss = cached.headers.get(MISS_HEADER);
    if (isMiss) {
      const ts = Number(cached.headers.get("x-miss-ts") ?? "0");
      if (Date.now() - ts < MISS_RETRY_MS) return null;
      await cache.delete(url);
    } else {
      await touchLru(url);
      return url;
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const cacheResponse = new Response(blob, {
      headers: { "Content-Type": blob.type },
    });
    await cache.put(url, cacheResponse);
    await touchLru(url);
    await evictIfNeeded(cache);
    return url;
  } catch {
    const missResponse = new Response("", {
      headers: {
        [MISS_HEADER]: "1",
        "x-miss-ts": String(Date.now()),
      },
    });
    await cache.put(url, missResponse);
    return null;
  }
}

export async function getTokenImageCached(
  chainId: number,
  address: string,
): Promise<string | null> {
  const url = cdnUrl(chainId, address);
  if (!url) return null;

  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);
    if (cached && !cached.headers.get(MISS_HEADER)) return url;
  } catch {
    /* cache API not available */
  }
  return null;
}

export async function prefetchTokenImages(
  tokens: Array<{ chainId: number; address: string }>,
): Promise<void> {
  const CONCURRENCY = 4;
  const queue = [...tokens];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const token = queue.shift();
      if (token) await getTokenImage(token.chainId, token.address);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}
