import { createPublicClient, http, type PublicClient } from "viem";
import {
  arbitrum,
  arbitrumSepolia,
  astar,
  avalanche,
  avalancheFuji,
  base,
  baseSepolia,
  blast,
  blastSepolia,
  celo,
  fantom,
  gnosis,
  linea,
  lineaSepolia,
  mainnet,
  mantle,
  moonbeam,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  polygonZkEvm,
  scroll,
  scrollSepolia,
  sepolia,
  zkSync,
} from "viem/chains";
import browser from "webextension-polyfill";
import { DEFAULT_NETWORK_ID, NETWORK_BY_ID, NETWORKS } from "../shared/constants";
import type { NetworkConfig } from "../shared/types";

const STORAGE_KEY = "activeNetworkId";
const RPC_PROVIDER_STORAGE_KEY = "rpcProviderKey";

const ALCHEMY_CHAIN_SLUGS: Record<number, string> = {
  [mainnet.id]: "eth-mainnet",
  [polygon.id]: "polygon-mainnet",
  [arbitrum.id]: "arb-mainnet",
  [optimism.id]: "opt-mainnet",
  [base.id]: "base-mainnet",
  [avalanche.id]: "avax-mainnet",
  [blast.id]: "blast-mainnet",
  [linea.id]: "linea-mainnet",
  [scroll.id]: "scroll-mainnet",
  [zkSync.id]: "zksync-mainnet",
  [mantle.id]: "mantle-mainnet",
  [celo.id]: "celo-mainnet",
  [gnosis.id]: "gnosis-mainnet",
  [polygonZkEvm.id]: "polygonzkevm-mainnet",
  [fantom.id]: "fantom-mainnet",
  [moonbeam.id]: "moonbeam-mainnet",
  [astar.id]: "astar-mainnet",
  [sepolia.id]: "eth-sepolia",
  [arbitrumSepolia.id]: "arb-sepolia",
  [baseSepolia.id]: "base-sepolia",
  [optimismSepolia.id]: "opt-sepolia",
  [polygonAmoy.id]: "polygon-amoy",
  [avalancheFuji.id]: "avax-fuji",
  [blastSepolia.id]: "blast-sepolia",
  [lineaSepolia.id]: "linea-sepolia",
  [scrollSepolia.id]: "scroll-sepolia",
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

const clientCache = new Map<number, PublicClient>();

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

export function getPublicClient(chainId: number) {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const network = NETWORK_BY_ID.get(chainId);
  if (!network) throw new Error(`Unknown chain ID: ${chainId}`);

  const client = createPublicClient({
    chain: network.chain,
    transport: http(getRpcUrl(chainId), { batch: true }),
    batch: { multicall: true },
  });

  clientCache.set(chainId, client);
  return client;
}
