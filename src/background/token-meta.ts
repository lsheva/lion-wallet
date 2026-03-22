import { readContract } from "viem/actions";
import { erc20Abi } from "../shared/abis";
import { getPublicClient } from "./networks";
import { StorageCache } from "./storage-cache";

export interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
}

const DEFAULTS: TokenMeta = { symbol: "???", name: "Unknown Token", decimals: 18 };

const store = new StorageCache<Record<string, TokenMeta>>("tokenMeta", "token-meta");

function cacheKey(chainId: number, addr: string): string {
  return `${chainId}:${addr.toLowerCase()}`;
}

export async function fetchTokenMeta(chainId: number, address: string): Promise<TokenMeta> {
  const cache = await store.load();
  const key = cacheKey(chainId, address);
  if (cache[key]) return cache[key];

  const client = getPublicClient(chainId);
  const hex = address as `0x${string}`;

  try {
    const [sym, name, dec] = await Promise.allSettled([
      readContract(client, { address: hex, abi: erc20Abi, functionName: "symbol" }),
      readContract(client, { address: hex, abi: erc20Abi, functionName: "name" }),
      readContract(client, { address: hex, abi: erc20Abi, functionName: "decimals" }),
    ]);

    const meta: TokenMeta = {
      symbol: sym.status === "fulfilled" ? String(sym.value) : DEFAULTS.symbol,
      name: name.status === "fulfilled" ? String(name.value) : DEFAULTS.name,
      decimals: dec.status === "fulfilled" ? Number(dec.value) : DEFAULTS.decimals,
    };

    cache[key] = meta;
    await store.persist();
    return meta;
  } catch {
    return { ...DEFAULTS };
  }
}

export async function fetchTokenMetaBatch(
  chainId: number,
  addresses: string[],
): Promise<Map<string, TokenMeta>> {
  const cache = await store.load();
  const result = new Map<string, TokenMeta>();
  const missing: string[] = [];

  for (const addr of addresses) {
    const k = cacheKey(chainId, addr);
    if (cache[k]) result.set(addr.toLowerCase(), cache[k]);
    else missing.push(addr);
  }

  if (missing.length > 0) {
    const client = getPublicClient(chainId);
    const calls = await Promise.allSettled(
      missing.flatMap((addr) => {
        const hex = addr as `0x${string}`;
        return [
          readContract(client, { address: hex, abi: erc20Abi, functionName: "symbol" }),
          readContract(client, { address: hex, abi: erc20Abi, functionName: "name" }),
          readContract(client, { address: hex, abi: erc20Abi, functionName: "decimals" }),
        ];
      }),
    );

    for (const [i, addr] of missing.entries()) {
      const sym = calls[i * 3];
      const nm = calls[i * 3 + 1];
      const dec = calls[i * 3 + 2];
      const meta: TokenMeta = {
        symbol: sym?.status === "fulfilled" ? String(sym.value) : DEFAULTS.symbol,
        name: nm?.status === "fulfilled" ? String(nm.value) : DEFAULTS.name,
        decimals: dec?.status === "fulfilled" ? Number(dec.value) : DEFAULTS.decimals,
      };
      const k = cacheKey(chainId, addr);
      cache[k] = meta;
      result.set(addr.toLowerCase(), meta);
    }
    await store.persist();
  }

  return result;
}

export async function clearTokenMetaCache(): Promise<void> {
  await store.clearStorage();
}
