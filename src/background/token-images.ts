import { CHAIN_BY_ID } from "@shared/constants";
import { getAddress } from "viem/utils";

const STORAGE_KEY = "tokenLogos";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 1 month
const MISS_RETRY_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

interface CachedImage {
  dataUrl: string | null; // null = miss sentinel
  ts: number;
}

function cdnUrl(chainId: number, address: string): string | null {
  const slug = CHAIN_BY_ID.get(chainId)?.trustSlug;
  if (!slug) return null;
  const checksummed = getAddress(address as `0x${string}`);
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${slug}/assets/${checksummed}/logo.png`;
}

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

async function loadCache(): Promise<Record<string, CachedImage>> {
  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    return (stored[STORAGE_KEY] as Record<string, CachedImage>) ?? {};
  } catch {
    return {};
  }
}

async function saveCache(cache: Record<string, CachedImage>): Promise<void> {
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: cache });
  } catch {
    /* non-critical */
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

function evictIfNeeded(cache: Record<string, CachedImage>): void {
  const entries = Object.entries(cache);
  if (entries.length <= MAX_ENTRIES) return;
  entries.sort((a, b) => a[1].ts - b[1].ts);
  const toRemove = entries.length - MAX_ENTRIES;
  for (let i = 0; i < toRemove; i++) {
    const key = entries[i]?.[0];
    if (key) delete cache[key];
  }
}

export async function getTokenImage(chainId: number, address: string): Promise<string | null> {
  const url = cdnUrl(chainId, address);
  if (!url) return null;

  const key = cacheKey(chainId, address);
  const cache = await loadCache();
  const entry = cache[key];
  const now = Date.now();

  if (entry) {
    if (entry.dataUrl === null) {
      if (now - entry.ts < MISS_RETRY_MS) return null;
    } else if (now - entry.ts < TTL_MS) {
      entry.ts = now;
      await saveCache(cache);
      return entry.dataUrl;
    }
    delete cache[key];
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);

    cache[key] = { dataUrl, ts: now };
    evictIfNeeded(cache);
    await saveCache(cache);
    return dataUrl;
  } catch {
    cache[key] = { dataUrl: null, ts: now };
    await saveCache(cache);
    return null;
  }
}

export async function clearTokenImageCache(): Promise<void> {
  try {
    await browser.storage.local.remove(STORAGE_KEY);
  } catch {
    /* non-critical */
  }
}
