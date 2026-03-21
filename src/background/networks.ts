import { type Chain, type Client, createClient, http } from "viem";

import { CHAIN_BY_ID, CHAINS, DEFAULT_NETWORK_ID } from "../shared/constants";
import type { ChainMeta } from "../shared/types";

const STORAGE_KEY = "activeNetworkId";
const RPC_PROVIDER_STORAGE_KEY = "rpcProviderKey";

let rpcProviderKey: string | null = null;

export async function loadRpcProviderKey(): Promise<void> {
  const result = await browser.storage.local.get(RPC_PROVIDER_STORAGE_KEY);
  rpcProviderKey = (result[RPC_PROVIDER_STORAGE_KEY] as string) ?? null;
}

export function setRpcProviderKeyInMemory(key: string | null): void {
  rpcProviderKey = key;
  clientCache.clear();
}

export function hasRpcProviderKey(): boolean {
  return rpcProviderKey !== null;
}

export function getRpcUrl(chainId: number): string | undefined {
  if (rpcProviderKey) {
    const slug = CHAIN_BY_ID.get(chainId)?.alchemySlug;
    if (slug) return `https://${slug}.g.alchemy.com/v2/${rpcProviderKey}`;
  }
  return undefined;
}

const clientCache = new Map<number, Client>();

export function getNetworkConfig(chainId: number): ChainMeta | undefined {
  return CHAIN_BY_ID.get(chainId);
}

export function getAllNetworks(): ChainMeta[] {
  return CHAINS;
}

export async function getActiveNetworkId(): Promise<number> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as number) ?? DEFAULT_NETWORK_ID;
}

export async function setActiveNetworkId(chainId: number): Promise<void> {
  if (!CHAIN_BY_ID.has(chainId)) {
    throw new Error(`Unknown chain ID: ${chainId}`);
  }
  await browser.storage.local.set({ [STORAGE_KEY]: chainId });
}

function toViemChain(meta: ChainMeta): Chain {
  return {
    id: meta.id,
    name: meta.name,
    nativeCurrency: meta.nativeCurrency,
    rpcUrls: { default: { http: [meta.rpcUrl ?? ""] } },
  } as Chain;
}

export function getPublicClient(chainId: number): Client {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const meta = CHAIN_BY_ID.get(chainId);
  if (!meta) throw new Error(`Unknown chain ID: ${chainId}`);

  const client = createClient({
    chain: toViemChain(meta),
    transport: http(getRpcUrl(chainId) ?? meta.rpcUrl, { batch: true }),
  });

  clientCache.set(chainId, client);
  return client;
}
