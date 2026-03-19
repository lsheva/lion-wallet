import browser from "webextension-polyfill";
import { createPublicClient, http, type PublicClient } from "viem";
import {
  mainnet,
  polygon,
  arbitrum,
  optimism,
  base,
  bsc,
  avalanche,
  sepolia,
} from "viem/chains";
import { NETWORKS, DEFAULT_NETWORK_ID } from "../shared/constants";
import type { NetworkConfig } from "../shared/types";

const STORAGE_KEY = "activeNetworkId";

const viemChains: Record<number, (typeof mainnet)> = {
  1: mainnet,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
  56: bsc,
  43114: avalanche,
  11155111: sepolia,
};

const clientCache = new Map<number, PublicClient>();

export function getNetworkConfig(chainId: number): NetworkConfig | undefined {
  return NETWORKS.find((n) => n.id === chainId);
}

export function getAllNetworks(): NetworkConfig[] {
  return NETWORKS;
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

export function getPublicClient(chainId: number): PublicClient {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const network = getNetworkConfig(chainId);
  if (!network) throw new Error(`Unknown chain ID: ${chainId}`);

  const chain = viemChains[chainId];
  const client = createPublicClient({
    chain,
    transport: http(network.rpcUrl),
  });

  clientCache.set(chainId, client);
  return client;
}
