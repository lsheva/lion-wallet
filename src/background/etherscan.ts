import browser from "webextension-polyfill";
import { getPublicClient } from "./networks";

async function getEtherscanApiKey(): Promise<string | null> {
  const result = await browser.storage.local.get("etherscanApiKey");
  return (result.etherscanApiKey as string) ?? null;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const ABI_CACHE = new Map<string, CacheEntry<unknown[] | null>>();
const PRICE_CACHE = new Map<string, CacheEntry<number>>();
const CACHE_TTL = 5 * 60 * 1000;

function cached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
}

const BASE_URL = "https://api.etherscan.io/v2/api";

async function etherscanFetch(
  params: Record<string, string>,
  chainId: number,
  log: string[],
): Promise<unknown> {
  const apiKey = await getEtherscanApiKey();
  log.push(`etherscan-api: key=${apiKey ? "yes" : "no"} action=${params.action}`);
  if (!apiKey) return null;

  const url = new URL(BASE_URL);
  url.searchParams.set("chainid", String(chainId));
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("apikey", apiKey);

  const fullUrl = url.toString();
  log.push(`etherscan-api: GET ${fullUrl.replace(/apikey=[^&]+/, "apikey=***")}`);

  try {
    const resp = await fetch(fullUrl);
    log.push(`etherscan-api: HTTP ${resp.status} ${resp.statusText}`);
    if (!resp.ok) return null;
    const body = await resp.json();
    const bodyStr = JSON.stringify(body);
    log.push(`etherscan-api: body ${bodyStr.length > 300 ? bodyStr.slice(0, 300) + "..." : bodyStr}`);
    return body;
  } catch (e) {
    log.push(`etherscan-api: fetch error: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// EIP-1967 implementation slot
const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as `0x${string}`;

export async function resolveImplementation(
  address: string,
  chainId: number,
  log: string[],
): Promise<string | null> {
  // Try Etherscan getsourcecode first (returns Implementation field for known proxies)
  try {
    const json = (await etherscanFetch(
      { module: "contract", action: "getsourcecode", address },
      chainId,
      log,
    )) as { status?: string; result?: Array<{ Proxy?: string; Implementation?: string }> } | null;

    if (json?.status === "1" && json.result?.[0]) {
      const info = json.result[0];
      if (info.Proxy === "1" && info.Implementation && info.Implementation !== ZERO_ADDRESS && info.Implementation !== "") {
        log.push(`proxy: Etherscan says impl=${info.Implementation}`);
        return info.Implementation;
      }
    }
  } catch (e) {
    log.push(`proxy: getsourcecode failed: ${e instanceof Error ? e.message : e}`);
  }

  // Fallback: read EIP-1967 storage slot via RPC
  try {
    const client = getPublicClient(chainId);
    const slot = await client.getStorageAt({
      address: address as `0x${string}`,
      slot: EIP1967_IMPL_SLOT,
    });
    if (slot && slot !== "0x" + "0".repeat(64)) {
      const impl = "0x" + slot.slice(26);
      if (impl.toLowerCase() !== ZERO_ADDRESS) {
        log.push(`proxy: EIP-1967 slot impl=${impl}`);
        return impl;
      }
    }
  } catch (e) {
    log.push(`proxy: EIP-1967 read failed: ${e instanceof Error ? e.message : e}`);
  }

  return null;
}

async function fetchAbiForAddress(
  address: string,
  chainId: number,
  log: string[],
): Promise<unknown[] | null> {
  const json = (await etherscanFetch(
    { module: "contract", action: "getabi", address },
    chainId,
    log,
  )) as { status?: string; result?: string; message?: string } | null;

  if (!json) {
    log.push("etherscan-abi: null response (no API key or fetch failed)");
    return null;
  }

  log.push(`etherscan-abi: status=${json.status} message=${json.message}`);

  if (json.status !== "1" || !json.result) {
    return null;
  }

  return JSON.parse(json.result) as unknown[];
}

export async function fetchContractAbi(
  address: string,
  chainId: number,
  log: string[] = [],
): Promise<unknown[] | null> {
  const cacheKey = `${chainId}:${address}`;
  const hit = cached(ABI_CACHE, cacheKey);
  if (hit !== undefined) {
    log.push(`etherscan-abi: cache hit (${hit ? "has ABI" : "null"})`);
    return hit;
  }

  try {
    // Try direct ABI first
    let abi = await fetchAbiForAddress(address, chainId, log);

    // If direct lookup failed or returned a proxy-only ABI, try to resolve implementation
    if (!abi) {
      log.push("etherscan-abi: direct lookup failed, checking for proxy");
      const impl = await resolveImplementation(address, chainId, log);
      if (impl) {
        log.push(`etherscan-abi: fetching implementation ABI from ${impl}`);
        abi = await fetchAbiForAddress(impl, chainId, log);
      }
    }

    cacheSet(ABI_CACHE, cacheKey, abi);
    return abi;
  } catch (e) {
    log.push(`etherscan-abi: exception: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

export async function fetchNativePrice(chainId: number): Promise<number | null> {
  const cacheKey = `native:${chainId}`;
  const hit = cached(PRICE_CACHE, cacheKey);
  if (hit !== undefined) return hit;

  const log: string[] = [];
  try {
    const json = (await etherscanFetch(
      { module: "stats", action: "ethprice" },
      chainId,
      log,
    )) as { status?: string; result?: { ethusd?: string } } | null;

    if (!json || json.status !== "1" || !json.result?.ethusd) return null;

    const price = parseFloat(json.result.ethusd);
    if (Number.isNaN(price)) return null;

    cacheSet(PRICE_CACHE, cacheKey, price);
    return price;
  } catch {
    return null;
  }
}
