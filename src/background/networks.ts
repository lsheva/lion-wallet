import { createClient, type Client, http } from "viem";
import browser from "webextension-polyfill";
import { DEFAULT_NETWORK_ID, NETWORK_BY_ID, NETWORKS } from "../shared/constants";
import type { NetworkConfig } from "../shared/types";

const STORAGE_KEY = "activeNetworkId";
const RPC_PROVIDER_STORAGE_KEY = "rpcProviderKey";

const ALCHEMY_CHAIN_SLUGS: Record<number, string> = {
  [1]: "eth-mainnet",
  [137]: "polygon-mainnet",
  [42161]: "arb-mainnet",
  [10]: "opt-mainnet",
  [8453]: "base-mainnet",
  [43114]: "avax-mainnet",
  [81457]: "blast-mainnet",
  [59144]: "linea-mainnet",
  [534352]: "scroll-mainnet",
  [324]: "zksync-mainnet",
  [5000]: "mantle-mainnet",
  [42220]: "celo-mainnet",
  [100]: "gnosis-mainnet",
  [1101]: "polygonzkevm-mainnet",
  [250]: "fantom-mainnet",
  [1284]: "moonbeam-mainnet",
  [592]: "astar-mainnet",
  [11155111]: "eth-sepolia",
  [421614]: "arb-sepolia",
  [84532]: "base-sepolia",
  [11155420]: "opt-sepolia",
  [80002]: "polygon-amoy",
  [43113]: "avax-fuji",
  [168587773]: "blast-sepolia",
  [59141]: "linea-sepolia",
  [534351]: "scroll-sepolia",
};

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
    const slug = ALCHEMY_CHAIN_SLUGS[chainId];
    if (slug) return `https://${slug}.g.alchemy.com/v2/${rpcProviderKey}`;
  }
  return undefined;
}

const clientCache = new Map<number, Client>();

export function getNetworkConfig(chainId: number): NetworkConfig | undefined {
  return NETWORK_BY_ID.get(chainId);
}

export function getAllNetworks(): NetworkConfig[] {
  return NETWORKS;
}

export async function getActiveNetworkId(): Promise<number> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as number) ?? DEFAULT_NETWORK_ID;
}

export async function setActiveNetworkId(chainId: number): Promise<void> {
  if (!NETWORK_BY_ID.has(chainId)) {
    throw new Error(`Unknown chain ID: ${chainId}`);
  }
  await browser.storage.local.set({ [STORAGE_KEY]: chainId });
}

export function getPublicClient(chainId: number): Client {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const network = NETWORK_BY_ID.get(chainId);
  if (!network) throw new Error(`Unknown chain ID: ${chainId}`);

  const client = createClient({
    chain: network.chain,
    transport: http(getRpcUrl(chainId), { batch: true }),
  });

  clientCache.set(chainId, client);
  return client;
}
