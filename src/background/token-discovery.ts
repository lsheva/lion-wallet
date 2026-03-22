import { CHAIN_BY_ID } from "../shared/constants";
import { ETHERSCAN_BASE_URL, getEtherscanApiKey } from "./etherscan";
import { bgLog } from "./log";
import { getPublicClient, hasRpcProviderKey } from "./networks";
import { fetchTokenMetaBatch, type TokenMeta } from "./token-meta";
import { addDiscoveredTokens, markTokensScanned, shouldScanTokens } from "./token-store";

const ETHERSCAN_TOKENTX_PAGE_SIZE = 1000;

/**
 * Scan the active chain for tokens held by `address`.
 *
 * Tier 1: Alchemy key present → alchemy_getTokenBalances
 * Tier 2: Etherscan key present → account?action=tokentx (large page)
 * Tier 3: No keys → no-op (activity-based discovery is the only source)
 *
 * Respects a persistent 1-hour TTL per (chain, address) pair.
 * Activity-based discovery always runs separately via activity.ts hooks.
 */
export async function scanTokens(address: string, chainId: number): Promise<number> {
  const canScan = await shouldScanTokens(chainId, address);
  if (!canScan) {
    bgLog("[token-discovery] scan rate-limited for chain", chainId);
    return 0;
  }
  await markTokensScanned(chainId, address);

  const meta = CHAIN_BY_ID.get(chainId);
  if (!meta) return 0;

  if (hasRpcProviderKey() && meta.alchemySlug) {
    const count = await scanViaAlchemy(address, chainId);
    if (count >= 0) return count;
  }

  const etherscanKey = await getEtherscanApiKey();
  if (etherscanKey) {
    return scanViaEtherscan(address, chainId, etherscanKey);
  }

  bgLog("[token-discovery] no API keys, relying on activity-based discovery only");
  return 0;
}

// ── Alchemy: alchemy_getTokenBalances ───────────────────────────────

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

async function scanViaAlchemy(address: string, chainId: number): Promise<number> {
  try {
    const client = getPublicClient(chainId);
    const result = (await client.request({
      method: "alchemy_getTokenBalances" as string,
      params: [address, "erc20"],
    } as never)) as { tokenBalances?: AlchemyTokenBalance[] };

    if (!result?.tokenBalances?.length) {
      bgLog("[token-discovery] alchemy: no tokens found on chain", chainId);
      return 0;
    }

    const nonZero = result.tokenBalances.filter(
      (t) => t.tokenBalance && t.tokenBalance !== "0x" && t.tokenBalance !== "0x0",
    );

    if (nonZero.length === 0) return 0;

    const addrs = nonZero.map((t) => t.contractAddress);
    const metaMap = await fetchTokenMetaBatch(chainId, addrs);
    const added = await addDiscoveredTokens(chainId, address, addrs, metaMap, "scan");

    bgLog(
      "[token-discovery] alchemy: chain",
      chainId,
      "found",
      nonZero.length,
      "tokens, added",
      added,
      "new",
    );
    return added;
  } catch (e) {
    bgLog("[token-discovery] alchemy scan failed for chain", chainId, ":", e);
    return -1;
  }
}

// ── Etherscan: account?action=tokentx ───────────────────────────────

async function scanViaEtherscan(
  address: string,
  chainId: number,
  apiKey: string,
): Promise<number> {
  try {
    const url = new URL(ETHERSCAN_BASE_URL);
    url.searchParams.set("chainid", String(chainId));
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "tokentx");
    url.searchParams.set("address", address);
    url.searchParams.set("startblock", "0");
    url.searchParams.set("endblock", "999999999");
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", String(ETHERSCAN_TOKENTX_PAGE_SIZE));
    url.searchParams.set("sort", "desc");
    url.searchParams.set("apikey", apiKey);

    const resp = await fetch(url.toString());
    if (!resp.ok) return 0;

    const body = (await resp.json()) as {
      status?: string;
      result?: Array<{
        contractAddress?: string;
        tokenSymbol?: string;
        tokenName?: string;
        tokenDecimal?: string;
      }>;
    };

    if (body.status !== "1" || !Array.isArray(body.result)) return 0;

    const metaMap = new Map<string, TokenMeta>();
    for (const tx of body.result) {
      if (!tx.contractAddress) continue;
      const addr = tx.contractAddress.toLowerCase();
      if (metaMap.has(addr)) continue;
      metaMap.set(addr, {
        symbol: tx.tokenSymbol ?? "???",
        name: tx.tokenName ?? "Unknown Token",
        decimals: Number(tx.tokenDecimal) || 18,
      });
    }

    if (metaMap.size === 0) return 0;

    const added = await addDiscoveredTokens(chainId, address, [...metaMap.keys()], metaMap, "scan");
    bgLog(
      "[token-discovery] etherscan: chain",
      chainId,
      "found",
      metaMap.size,
      "tokens, added",
      added,
      "new",
    );
    return added;
  } catch (e) {
    bgLog("[token-discovery] etherscan scan failed for chain", chainId, ":", e);
    return 0;
  }
}
