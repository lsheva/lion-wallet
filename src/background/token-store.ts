import type { StoredToken } from "../shared/types";
import { bgLog } from "./log";
import { StorageCache } from "./storage-cache";
import type { TokenMeta } from "./token-meta";

type TokenStoreData = Record<string, StoredToken>;

const store = new StorageCache<TokenStoreData>("discoveredTokens", "token-store");

function key(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export async function addDiscoveredTokens(
  chainId: number,
  addresses: string[],
  metaMap: Map<string, TokenMeta>,
  source: StoredToken["source"] = "activity",
): Promise<number> {
  const data = await store.load();
  let added = 0;

  for (const addr of addresses) {
    const k = key(chainId, addr);
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
    bgLog("[token-store] added", added, "tokens on chain", chainId);
  }
  return added;
}

export async function addManualToken(
  chainId: number,
  address: string,
  meta: TokenMeta,
): Promise<void> {
  const data = await store.load();
  const k = key(chainId, address);
  data[k] = {
    address: address.toLowerCase(),
    chainId,
    symbol: meta.symbol,
    name: meta.name,
    decimals: meta.decimals,
    source: "manual",
    addedAt: Date.now(),
  };
  await store.persist();
}

export async function getTokensForChain(chainId: number): Promise<StoredToken[]> {
  const data = await store.load();
  const prefix = `${chainId}:`;
  const tokens: StoredToken[] = [];
  for (const [k, token] of Object.entries(data)) {
    if (k.startsWith(prefix) && !token.hidden) {
      tokens.push(token);
    }
  }
  return tokens;
}

export async function hideToken(chainId: number, address: string): Promise<void> {
  const data = await store.load();
  const k = key(chainId, address);
  if (data[k]) {
    data[k].hidden = true;
    await store.persist();
  }
}

export async function unhideToken(chainId: number, address: string): Promise<void> {
  const data = await store.load();
  const k = key(chainId, address);
  if (data[k]) {
    delete data[k].hidden;
    await store.persist();
  }
}

export async function clearTokenStore(): Promise<void> {
  await store.clearStorage();
}
