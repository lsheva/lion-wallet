import browser from "webextension-polyfill";
import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import {
  mainnet,
  polygon,
  arbitrum,
  optimism,
  base,
  bsc,
  avalanche,
  sepolia,
  arbitrumSepolia,
  hardhat,
} from "viem/chains";
import { NETWORKS, DEFAULT_NETWORK_ID } from "../shared/constants";
import type { NetworkConfig } from "../shared/types";

const STORAGE_KEY = "activeNetworkId";
const RPC_PROVIDER_STORAGE_KEY = "rpcProviderKey";

const ALCHEMY_CHAIN_SLUGS: Record<number, string> = {
  1: "eth-mainnet",
  137: "polygon-mainnet",
  42161: "arb-mainnet",
  10: "opt-mainnet",
  8453: "base-mainnet",
  43114: "avax-mainnet",
  11155111: "eth-sepolia",
  421614: "arb-sepolia",
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

const viemChains: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
  56: bsc,
  43114: avalanche,
  11155111: sepolia,
  421614: arbitrumSepolia,
  31337: hardhat,
};

const clientCache = new Map<number, PublicClient>();

export function getNetworkConfig(chainId: number): NetworkConfig | undefined {
  return NETWORKS.find((n) => n.id === chainId);
}

export function getAllNetworks(): NetworkConfig[] {
  return NETWORKS;
}

export function getViemChain(chainId: number): Chain | undefined {
  return viemChains[chainId];
}

export async function getActiveNetworkId(): Promise<number> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as number) ?? DEFAULT_NETWORK_ID;
}

export async function setActiveNetworkId(chainId: number): Promise<void> {
  if (!NETWORKS.some((n) => n.id === chainId)) {
    throw new Error(`Unknown chain ID: ${chainId}`);
  }
  await browser.storage.local.set({ [STORAGE_KEY]: chainId });
}

export function getPublicClient(chainId: number) {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const chain = viemChains[chainId];
  if (!chain) throw new Error(`Unknown chain ID: ${chainId}`);

  const client = createPublicClient({
    chain,
    transport: http(getRpcUrl(chainId)),
  });

  clientCache.set(chainId, client);
  return client;
}
