import type { Chain, Client } from "viem";
import { createClient, fallback, http } from "viem";

import { CHAIN_BY_ID, CHAINS, DEFAULT_NETWORK_ID } from "../shared/constants";
import { DEV_RPC_PROXY_PREFIX, encodeRpcUrlForDevProxy } from "../shared/dev-rpc-proxy";
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

/** In Vite tab dev, tunnel any RPC URL through the dev server to avoid provider CORS blocks. */
function applyDevTabRpcProxy(rpcUrl: string | undefined): string | undefined {
  if (!rpcUrl || !import.meta.env?.DEV) return rpcUrl;
  const loc =
    typeof globalThis !== "undefined" && "location" in globalThis
      ? (globalThis.location as URL | Location)
      : null;
  const origin = loc && "origin" in loc ? loc.origin : "";
  if (!origin || loc?.protocol === "chrome-extension:") return rpcUrl;
  const seg = encodeRpcUrlForDevProxy(rpcUrl);
  return `${origin}${DEV_RPC_PROXY_PREFIX}${seg}`;
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
  const httpRpcs = meta.rpcUrls?.length ? meta.rpcUrls : meta.rpcUrl ? [meta.rpcUrl] : [""];
  return {
    id: meta.id,
    name: meta.name,
    nativeCurrency: meta.nativeCurrency,
    rpcUrls: { default: { http: httpRpcs } },
  } as Chain;
}

function publicRpcUrlList(meta: ChainMeta, privateRpcUrl: string | undefined): string[] {
  if (privateRpcUrl) return [privateRpcUrl];
  if (meta.rpcUrls?.length) return meta.rpcUrls;
  if (meta.rpcUrl) return [meta.rpcUrl];
  return [];
}

export function getPublicClient(chainId: number): Client {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const meta = CHAIN_BY_ID.get(chainId);
  if (!meta) throw new Error(`Unknown chain ID: ${chainId}`);

  const privateRpcUrl = getRpcUrl(chainId);
  const urls = publicRpcUrlList(meta, privateRpcUrl);
  if (!urls.length) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
  const proxied = urls.map((u) => applyDevTabRpcProxy(u) ?? u);
  const batch = !!privateRpcUrl;
  const transport =
    proxied.length === 1
      ? http(proxied[0], { batch })
      : fallback(proxied.map((url) => http(url, { batch })));

  const chainMetaForClient =
    privateRpcUrl != null ? { ...meta, rpcUrl: privateRpcUrl, rpcUrls: [privateRpcUrl] } : meta;

  const client = createClient({
    chain: toViemChain(chainMetaForClient),
    transport,
  });

  clientCache.set(chainId, client);
  return client;
}
