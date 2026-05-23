/**
 * Tuning constants for the activity pipeline.
 *
 * Numbers here should be revisited if free-tier Etherscan / Alchemy quotas
 * change, or if mobile RAM constraints push us to drop the cache cap.
 */

/** Etherscan/RPC page size per request. */
export const FETCH_PAGE_SIZE = 50;
/** Max transactions kept in cache (load more appends until this cap). */
export const MAX_CACHED_ITEMS = 250;
/** How many txs to enrich (fetch + decode logs) per refresh batch. */
export const ENRICH_BATCH = 5;
/** Etherscan getLogs `offset` (per-page size). */
export const ETHERSCAN_LOGS_PAGE_SIZE = 1000;
/** Inter-chain rate limit for refresh hits per address+chain key. */
export const RATE_LIMIT_MS = 60_000;
/** Initial RPC `eth_getLogs` block range (chains without Etherscan key). */
export const INITIAL_BLOCK_RANGE = 10_000;
/** Range for "discover ERC-20s by transfer event" RPC scans. */
export const TOKEN_DISCOVERY_BLOCK_RANGE = 50_000;
/** Lower bound when adaptively shrinking the RPC block range. */
export const MIN_BLOCK_RANGE = 500;
/** Etherscan `tokentx` page size used during token discovery. */
export const ETHERSCAN_TOKENTX_DISCOVERY_SIZE = 1000;
/** Solidity `Transfer(address,address,uint256)` event topic. */
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const STORAGE_KEY = "activityCache";

export type ActivitySource = "etherscan" | "rpc" | "cache";
