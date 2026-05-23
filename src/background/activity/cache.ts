/**
 * Persistent cache for activity items, keyed by `${chainId}:${address}`.
 *
 * `mergeActivityItems` resolves the "we have two records of the same hash —
 * one bare from `txlist`, one enriched with logs" case by preferring the
 * richer side per field. `dedup` collapses an unsorted list into the latest
 * `MAX_CACHED_ITEMS` entries, newest first.
 */
import type { ActivityItem, TokenMovement } from "../../shared/types";
import { StorageCache } from "../storage-cache";
import { type ActivitySource, MAX_CACHED_ITEMS, STORAGE_KEY } from "./constants";

export interface CacheEntry {
  items: ActivityItem[];
  pendingHashes: string[];
  pendingTransfers: Record<string, TokenMovement[]>;
  source: ActivitySource;
  /** Last Etherscan txlist fetch returned a full page — older txs may exist. */
  etherscanHasMore?: boolean;
}

export const activityStore = new StorageCache<Record<string, CacheEntry>>(STORAGE_KEY, "activity");

/** Per-key throttle for refreshes (see `RATE_LIMIT_MS`). */
export const lastFetchTs = new Map<string, number>();

export function actCacheKey(address: string, chainId: number): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export function loadActivityCache(): Promise<Record<string, CacheEntry>> {
  return activityStore.load();
}

export function persistActivityCache(): Promise<void> {
  return activityStore.persist();
}

export function mergeActivityItems(a: ActivityItem, b: ActivityItem): ActivityItem {
  const transfers = a.transfers.length >= b.transfers.length ? a.transfers : b.transfers;
  const events = a.events.length >= b.events.length ? a.events : b.events;
  const decoded = a.decoded ?? b.decoded;
  const fn = decoded?.functionName ?? (a.fn || b.fn);
  return {
    ...a,
    transfers,
    events,
    decoded,
    fn,
  };
}

export function dedup(items: ActivityItem[]): ActivityItem[] {
  const seen = new Map<string, ActivityItem>();
  for (const item of items) {
    const prev = seen.get(item.hash);
    seen.set(item.hash, prev ? mergeActivityItems(prev, item) : item);
  }
  return [...seen.values()].sort((a, b) => b.ts - a.ts).slice(0, MAX_CACHED_ITEMS);
}
