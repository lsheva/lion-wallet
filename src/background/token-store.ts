import type { StoredToken } from "../shared/types";
import { bgLog } from "./log";
import { StorageCache } from "./storage-cache";
import type { TokenMeta } from "./token-meta";

type TokenStoreData = Record<string, StoredToken>;

const store = new StorageCache<TokenStoreData>("discoveredTokens", "token-store");
const scanTsStore = new StorageCache<Record<string, number>>("tokenScanTs", "token-scan-ts");

const SCAN_TTL_MS = 60 * 60 * 1000; // 1 hour

function key(chainId: number, walletAddress: string, tokenAddress: string): string {
  return `${chainId}:${walletAddress.toLowerCase()}:${tokenAddress.toLowerCase()}`;
}

function scanTsKey(chainId: number, walletAddress: string): string {
  return `${chainId}:${walletAddress.toLowerCase()}`;
}

export async function shouldScanTokens(chainId: number, walletAddress: string): Promise<boolean> {
  const tsMap = await scanTsStore.load();
  const lastTs = tsMap[scanTsKey(chainId, walletAddress)] ?? 0;
  return Date.now() - lastTs >= SCAN_TTL_MS;
}

export async function markTokensScanned(chainId: number, walletAddress: string): Promise<void> {
  const tsMap = await scanTsStore.load();
  tsMap[scanTsKey(chainId, walletAddress)] = Date.now();
  await scanTsStore.persist();
}

export async function addDiscoveredTokens(
  chainId: number,
  walletAddress: string,
  addresses: string[],
  metaMap: Map<string, TokenMeta>,
  source: StoredToken["source"] = "activity",
): Promise<number> {
  const data = await store.load();
  let added = 0;

  for (const addr of addresses) {
    const k = key(chainId, walletAddress, addr);
    if (data[k]) continue;

    const meta = metaMap.get(addr.toLowerCase());
    if (!meta || meta.symbol === "???") continue;

    data[k] = {
      address: addr.toLowerCase(),
      chainId,
      symbol: meta.symbol,
      name: meta.name,
      decimals: meta.decimals,
      source,
      addedAt: Date.now(),
    };
    added++;
  }

  if (added > 0) {
    await store.persist();
    bgLog("[token-store] added", added, "tokens on chain", chainId, "for", walletAddress);
  }
  return added;
}

export async function addManualToken(
  chainId: number,
  walletAddress: string,
  tokenAddress: string,
  meta: TokenMeta,
): Promise<void> {
  const data = await store.load();
  const k = key(chainId, walletAddress, tokenAddress);
  data[k] = {
    address: tokenAddress.toLowerCase(),
    chainId,
    symbol: meta.symbol,
    name: meta.name,
    decimals: meta.decimals,
    source: "manual",
    addedAt: Date.now(),
  };
  await store.persist();
}

export async function getTokensForChain(
  chainId: number,
  walletAddress: string,
): Promise<StoredToken[]> {
  const data = await store.load();
  const prefix = `${chainId}:${walletAddress.toLowerCase()}:`;
  const tokens: StoredToken[] = [];
  for (const [k, token] of Object.entries(data)) {
    if (k.startsWith(prefix) && !token.hidden) {
      tokens.push(token);
    }
  }
  return tokens;
}

export async function hideToken(
  chainId: number,
  walletAddress: string,
  tokenAddress: string,
): Promise<void> {
  const data = await store.load();
  const k = key(chainId, walletAddress, tokenAddress);
  if (data[k]) {
    data[k].hidden = true;
    await store.persist();
  }
}

export async function unhideToken(
  chainId: number,
  walletAddress: string,
  tokenAddress: string,
): Promise<void> {
  const data = await store.load();
  const k = key(chainId, walletAddress, tokenAddress);
  if (data[k]) {
    delete data[k].hidden;
    await store.persist();
  }
}

export async function clearTokenStore(): Promise<void> {
  await store.clearStorage();
  await scanTsStore.clearStorage();
}
