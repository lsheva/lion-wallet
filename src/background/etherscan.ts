import browser from "webextension-polyfill";
import { bgLog } from "./log";
import { getPublicClient } from "./networks";

async function getEtherscanApiKey(): Promise<string | null> {
  const result = await browser.storage.local.get("etherscanApiKey");
  return (result.etherscanApiKey as string) ?? null;
}

// ── Price cache (in-memory, short TTL) ──────────────────────────────

interface TimedEntry<T> {
  value: T;
  expiresAt: number;
}

const PRICE_CACHE = new Map<string, TimedEntry<number>>();
const PRICE_TTL = 5 * 60 * 1000;

// ── Persistent ABI + proxy caches ───────────────────────────────────

const ABI_STORAGE_KEY = "abiCache";
const PROXY_STORAGE_KEY = "proxyImplCache";

let abiCacheMem: Record<string, unknown[] | null> | null = null;
let proxyImplMem: Record<string, string | null> | null = null;

function cacheKey(chainId: number, addr: string): string {
  return `${chainId}:${addr.toLowerCase()}`;
}

async function loadAbiCache(): Promise<Record<string, unknown[] | null>> {
  if (abiCacheMem) return abiCacheMem;
  try {
    const r = await browser.storage.local.get(ABI_STORAGE_KEY);
    abiCacheMem = (r[ABI_STORAGE_KEY] as Record<string, unknown[] | null>) ?? {};
  } catch {
    abiCacheMem = {};
  }
  return abiCacheMem;
}

async function persistAbiCache(): Promise<void> {
  if (!abiCacheMem) return;
  try {
    await browser.storage.local.set({ [ABI_STORAGE_KEY]: abiCacheMem });
  } catch (e) {
    bgLog("[etherscan] persistAbiCache failed:", e);
  }
}

async function loadProxyCache(): Promise<Record<string, string | null>> {
  if (proxyImplMem) return proxyImplMem;
  try {
    const r = await browser.storage.local.get(PROXY_STORAGE_KEY);
    proxyImplMem = (r[PROXY_STORAGE_KEY] as Record<string, string | null>) ?? {};
  } catch {
    proxyImplMem = {};
  }
  return proxyImplMem;
}

async function persistProxyCache(): Promise<void> {
  if (!proxyImplMem) return;
  try {
    await browser.storage.local.set({ [PROXY_STORAGE_KEY]: proxyImplMem });
  } catch (e) {
    bgLog("[etherscan] persistProxyCache failed:", e);
  }
}

// ── Etherscan HTTP helper ───────────────────────────────────────────

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
    log.push(
      `etherscan-api: body ${bodyStr.length > 300 ? `${bodyStr.slice(0, 300)}...` : bodyStr}`,
    );
    return body;
  } catch (e) {
    log.push(`etherscan-api: fetch error: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ── Proxy resolution ────────────────────────────────────────────────

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EIP1967_IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as `0x${string}`;

export async function resolveImplementation(
  address: string,
  chainId: number,
  log: string[],
): Promise<string | null> {
  const proxyCache = await loadProxyCache();
  const pk = cacheKey(chainId, address);
  if (pk in proxyCache) {
    const cached = proxyCache[pk];
    log.push(`proxy: cache hit impl=${cached ?? "not a proxy"}`);
    return cached;
  }

  let impl: string | null = null;

  try {
    const json = (await etherscanFetch(
      { module: "contract", action: "getsourcecode", address },
      chainId,
      log,
    )) as { status?: string; result?: Array<{ Proxy?: string; Implementation?: string }> } | null;

    if (json?.status === "1" && json.result?.[0]) {
      const info = json.result[0];
      if (
        info.Proxy === "1" &&
        info.Implementation &&
        info.Implementation !== ZERO_ADDRESS &&
        info.Implementation !== ""
      ) {
        log.push(`proxy: Etherscan says impl=${info.Implementation}`);
        impl = info.Implementation;
      }
    }
  } catch (e) {
    log.push(`proxy: getsourcecode failed: ${e instanceof Error ? e.message : e}`);
  }

  if (!impl) {
    try {
      const client = getPublicClient(chainId);
      const slot = await client.getStorageAt({
        address: address as `0x${string}`,
        slot: EIP1967_IMPL_SLOT,
      });
      if (slot && slot !== `0x${"0".repeat(64)}`) {
        const resolved = `0x${slot.slice(26)}`;
        if (resolved.toLowerCase() !== ZERO_ADDRESS) {
          log.push(`proxy: EIP-1967 slot impl=${resolved}`);
          impl = resolved;
        }
      }
    } catch (e) {
      log.push(`proxy: EIP-1967 read failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  proxyCache[pk] = impl;
  await persistProxyCache();
  return impl;
}

// ── ABI fetching ────────────────────────────────────────────────────

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

  try {
    return JSON.parse(json.result) as unknown[];
  } catch {
    log.push("etherscan-abi: malformed JSON in ABI response");
    return null;
  }
}

export async function fetchContractAbi(
  address: string,
  chainId: number,
  log: string[] = [],
): Promise<unknown[] | null> {
  const abiCache = await loadAbiCache();
  const addrLower = address.toLowerCase();

  const proxyCache = await loadProxyCache();
  const pk = cacheKey(chainId, addrLower);
  const knownImpl = pk in proxyCache ? proxyCache[pk] : undefined;

  const implAddr = knownImpl ?? addrLower;
  const ak = cacheKey(chainId, implAddr);
  if (ak in abiCache) {
    log.push(`etherscan-abi: cache hit for ${implAddr} (${abiCache[ak] ? "has ABI" : "null"})`);
    return abiCache[ak];
  }

  try {
    let abi = await fetchAbiForAddress(address, chainId, log);

    if (!abi) {
      log.push("etherscan-abi: direct lookup failed, checking for proxy");
      const impl = await resolveImplementation(address, chainId, log);
      if (impl) {
        log.push(`etherscan-abi: fetching implementation ABI from ${impl}`);
        abi = await fetchAbiForAddress(impl, chainId, log);
        const implKey = cacheKey(chainId, impl);
        abiCache[implKey] = abi;
      }
    } else {
      abiCache[ak] = abi;
    }

    if (!abi) abiCache[ak] = null;
    await persistAbiCache();
    return abi;
  } catch (e) {
    log.push(`etherscan-abi: exception: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/**
 * Batch-resolve ABIs for multiple contract addresses.
 * Returns a Map from original address (lowercase) to its ABI.
 * Resolves proxies and deduplicates implementation lookups.
 */
export async function resolveAbis(
  chainId: number,
  addresses: string[],
): Promise<Map<string, unknown[]>> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const result = new Map<string, unknown[]>();
  const toFetch: string[] = [];

  const abiCache = await loadAbiCache();
  const proxyCache = await loadProxyCache();

  for (const addr of unique) {
    const pk = cacheKey(chainId, addr);
    const proxyVal = proxyCache[pk];
    const implAddr = pk in proxyCache && proxyVal ? proxyVal : addr;
    const ak = cacheKey(chainId, implAddr);
    const cachedAbi = abiCache[ak];
    if (ak in abiCache && cachedAbi) {
      result.set(addr, cachedAbi);
    } else if (!(ak in abiCache)) {
      toFetch.push(addr);
    }
  }

  if (toFetch.length > 0) {
    bgLog("[abi] batch fetching", toFetch.length, "ABIs");
    const settled = await Promise.allSettled(
      toFetch.map((addr) => fetchContractAbi(addr, chainId)),
    );
    for (let i = 0; i < toFetch.length; i++) {
      const r = settled[i];
      if (r.status === "fulfilled" && r.value) {
        result.set(toFetch[i], r.value);
      }
    }
  }

  return result;
}

export async function clearAbiCache(): Promise<void> {
  abiCacheMem = {};
  proxyImplMem = {};
  try {
    await browser.storage.local.remove([ABI_STORAGE_KEY, PROXY_STORAGE_KEY]);
  } catch (e) {
    bgLog("[etherscan] clearAbiCache failed:", e);
  }
}

// ── Price fetching ──────────────────────────────────────────────────

export async function fetchNativePrice(chainId: number): Promise<number | null> {
  const priceKey = `native:${chainId}`;
  const hit = PRICE_CACHE.get(priceKey);
  if (hit && Date.now() < hit.expiresAt) return hit.value;

  const log: string[] = [];
  try {
    const json = (await etherscanFetch({ module: "stats", action: "ethprice" }, chainId, log)) as {
      status?: string;
      result?: { ethusd?: string };
    } | null;

    if (!json || json.status !== "1" || !json.result?.ethusd) return null;

    const price = parseFloat(json.result.ethusd);
    if (Number.isNaN(price)) return null;

    PRICE_CACHE.set(priceKey, { value: price, expiresAt: Date.now() + PRICE_TTL });
    return price;
  } catch {
    return null;
  }
}
