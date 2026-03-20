import { type Abi, decodeEventLog, erc20Abi, type Hex } from "viem";
import { getBlockNumber, getTransaction, readContract } from "viem/actions";
import browser from "webextension-polyfill";
import type {
  ActivityItem,
  DecodedArg,
  DecodedCall,
  DecodedEvent,
  TokenMovement,
} from "../shared/types";
import { resolveAbis } from "./etherscan";
import { bgLog } from "./log";
import { getPublicClient } from "./networks";
import { stringify, tryDecode } from "./tx-decoder";

import { StorageCache } from "./storage-cache";

const STORAGE_KEY = "activityCache";
const TOKEN_META_KEY = "tokenMeta";
/** Etherscan/RPC page size per request */
const FETCH_PAGE_SIZE = 50;
/** Max transactions kept in cache (load more appends until this cap) */
const MAX_CACHED_ITEMS = 250;
const ENRICH_BATCH = 5;
const ETHERSCAN_LOGS_PAGE_SIZE = 1000;
const RATE_LIMIT_MS = 60_000;
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";
const INITIAL_BLOCK_RANGE = 10_000;
const MIN_BLOCK_RANGE = 500;

export type ActivitySource = "etherscan" | "rpc" | "cache";

// ── Token metadata cache (persistent) ────────────────────────────────

interface TokenMeta {
  symbol: string;
  decimals: number;
}

const tokenMetaStore = new StorageCache<Record<string, TokenMeta>>(TOKEN_META_KEY, "activity-tokenMeta");

async function loadTokenMeta() {
  return tokenMetaStore.load();
}

async function persistTokenMeta() {
  return tokenMetaStore.persist();
}

function tmKey(chainId: number, addr: string): string {
  return `${chainId}:${addr.toLowerCase()}`;
}

async function resolveTokenMeta(
  chainId: number,
  addresses: string[],
): Promise<Map<string, TokenMeta>> {
  const cache = await loadTokenMeta();
  const result = new Map<string, TokenMeta>();
  const missing: string[] = [];

  for (const addr of addresses) {
    const k = tmKey(chainId, addr);
    if (cache[k]) result.set(addr.toLowerCase(), cache[k]);
    else missing.push(addr);
  }

  if (missing.length > 0) {
    const client = getPublicClient(chainId);
    const calls = await Promise.allSettled(
      missing.flatMap((addr) => [
        readContract(client, {
          address: addr as `0x${string}`,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        readContract(client, {
          address: addr as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]),
    );
    for (let i = 0; i < missing.length; i++) {
      const sym = calls[i * 2]!;
      const dec = calls[i * 2 + 1]!;
      const meta: TokenMeta = {
        symbol: sym.status === "fulfilled" ? String(sym.value) : "???",
        decimals: dec.status === "fulfilled" ? Number(dec.value) : 18,
      };
      const k = tmKey(chainId, missing[i]!);
      cache[k] = meta;
      result.set(missing[i]!.toLowerCase(), meta);
    }
    await persistTokenMeta();
  }

  return result;
}

// ── Activity cache ───────────────────────────────────────────────────

interface CacheEntry {
  items: ActivityItem[];
  pendingHashes: string[];
  pendingTransfers: Record<string, TokenMovement[]>;
  source: ActivitySource;
  /** Last Etherscan txlist fetch returned a full page — older txs may exist */
  etherscanHasMore?: boolean;
}

const activityStore = new StorageCache<Record<string, CacheEntry>>(STORAGE_KEY, "activity");
const lastFetchTs = new Map<string, number>();

function actCacheKey(address: string, chainId: number): string {
  return `${chainId}:${address.toLowerCase()}`;
}

async function loadCache() {
  return activityStore.load();
}

async function persist() {
  return activityStore.persist();
}

function mergeActivityItems(a: ActivityItem, b: ActivityItem): ActivityItem {
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

function dedup(items: ActivityItem[]): ActivityItem[] {
  const seen = new Map<string, ActivityItem>();
  for (const item of items) {
    const prev = seen.get(item.hash);
    seen.set(item.hash, prev ? mergeActivityItems(prev, item) : item);
  }
  return [...seen.values()].sort((a, b) => b.ts - a.ts).slice(0, MAX_CACHED_ITEMS);
}

// ── Etherscan: fetch all events ─────────────────────────────────────

interface RawEventLog {
  address: string;
  topics: string[];
  data: string;
  transactionHash: string;
}

async function getEtherscanApiKey(): Promise<string | null> {
  const r = await browser.storage.local.get("etherscanApiKey");
  return (r.etherscanApiKey as string) ?? null;
}

function parseFn(raw: string): string {
  if (!raw) return "";
  const p = raw.indexOf("(");
  return p > 0 ? raw.slice(0, p) : raw;
}

async function fetchLogsForTopic(
  chainId: number,
  fromBlock: string,
  toBlock: string,
  topicIndex: 1 | 2,
  padded: string,
  apiKey: string,
): Promise<RawEventLog[]> {
  const out: RawEventLog[] = [];
  let page = 1;
  while (true) {
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set("chainid", String(chainId));
    url.searchParams.set("module", "logs");
    url.searchParams.set("action", "getLogs");
    url.searchParams.set("fromBlock", fromBlock);
    url.searchParams.set("toBlock", toBlock);
    url.searchParams.set(`topic${topicIndex}`, padded);
    url.searchParams.set("page", String(page));
    url.searchParams.set("offset", String(ETHERSCAN_LOGS_PAGE_SIZE));
    url.searchParams.set("apikey", apiKey);

    const resp = await fetch(url.toString());
    if (!resp.ok) break;
    try {
      const body = (await resp.json()) as { status?: string; result?: unknown[] };
      if (body.status !== "1" || !Array.isArray(body.result)) break;
      const batch = body.result as RawEventLog[];
      out.push(...batch);
      if (batch.length < ETHERSCAN_LOGS_PAGE_SIZE) break;
      page += 1;
    } catch {
      break;
    }
  }
  return out;
}

async function fetchAllEvents(
  address: string,
  chainId: number,
  fromBlock: string,
  toBlock: string,
  apiKey: string,
): Promise<Map<string, RawEventLog[]>> {
  const padded = `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
  const result = new Map<string, RawEventLog[]>();

  const [logs1, logs2] = await Promise.all([
    fetchLogsForTopic(chainId, fromBlock, toBlock, 1, padded, apiKey),
    fetchLogsForTopic(chainId, fromBlock, toBlock, 2, padded, apiKey),
  ]);

  const allLogs: RawEventLog[] = [...logs1, ...logs2];

  const seen = new Set<string>();
  for (const log of allLogs) {
    if (!log.transactionHash) continue;
    const dedupKey = `${log.transactionHash}:${log.address}:${log.topics?.join(",")}:${log.data}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const hash = log.transactionHash.toLowerCase();
    const arr = result.get(hash);
    if (arr) arr.push(log);
    else result.set(hash, [log]);
  }

  bgLog("[activity] fetchAllEvents:", allLogs.length, "raw logs,", result.size, "unique txs");
  return result;
}

// ── Decode & enrich ─────────────────────────────────────────────────

function parseErc20TransferArgs(args: unknown): { from: string; to: string; value: bigint } | null {
  if (args == null || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  const from = a.from;
  const to = a.to;
  const value = a.value;
  if (typeof from !== "string" || typeof to !== "string" || value === undefined) return null;
  try {
    const v = typeof value === "bigint" ? value : BigInt(String(value));
    return { from, to, value: v };
  } catch {
    return null;
  }
}

interface RawTransferRow {
  token: string;
  from: string;
  to: string;
  value: bigint;
}

function collectContractAddresses(
  txItems: Array<Record<string, string>>,
  eventsByHash: Map<string, RawEventLog[]>,
): Set<string> {
  const addrs = new Set<string>();
  for (const tx of txItems) {
    if (tx.to) addrs.add(tx.to.toLowerCase());
  }
  for (const logs of eventsByHash.values()) {
    for (const log of logs) {
      if (log.address) addrs.add(log.address.toLowerCase());
    }
  }
  return addrs;
}

function decodeTxInput(
  tx: Record<string, string>,
  abiMap: Map<string, unknown[]>,
): DecodedCall | null {
  const txData = tx.input ?? tx.data;
  if (!txData || txData === "0x" || txData.length < 10 || !tx.to) return null;
  const abi = abiMap.get(tx.to.toLowerCase());
  if (!abi) return null;
  try {
    return tryDecode(abi as unknown[], txData as Hex);
  } catch {
    return null;
  }
}

function processLogEntry(
  log: RawEventLog,
  abiMap: Map<string, unknown[]>,
): { events: DecodedEvent[]; transfers: RawTransferRow[]; gotTransfer: boolean } {
  const events: DecodedEvent[] = [];
  const transfers: RawTransferRow[] = [];
  let gotTransfer = false;

  if (!log.topics?.length) return { events, transfers, gotTransfer };
  const logAddr = log.address.toLowerCase();
  const logAbi = abiMap.get(logAddr);

  if (logAbi) {
    try {
      const dec = decodeEventLog({
        abi: logAbi as Abi,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      const abiItem = (
        logAbi as Array<{
          type?: string;
          name?: string;
          inputs?: Array<{ name: string; type: string }>;
        }>
      ).filter((item) => item.type === "event" && item.name === dec.eventName);
      const eventDef = abiItem[0];
      const args: DecodedArg[] = dec.args
        ? Object.entries(dec.args)
            .filter(([key]) => Number.isNaN(Number(key)))
            .map(([key, val], i) => ({
              name: eventDef?.inputs?.[i]?.name ?? key,
              type: eventDef?.inputs?.[i]?.type ?? "unknown",
              value: stringify(val),
            }))
        : [];
      events.push({ name: dec.eventName ?? "Unknown", args, contract: logAddr });

      if (dec.eventName === "Transfer") {
        const tfer = parseErc20TransferArgs(dec.args);
        if (tfer) {
          gotTransfer = true;
          transfers.push({ token: logAddr, from: tfer.from, to: tfer.to, value: tfer.value });
        }
      }
    } catch {
      /* try erc-20 fallback below */
    }
  }

  if (!gotTransfer && log.topics.length === 3) {
    try {
      const dec = decodeEventLog({
        abi: erc20Abi,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (dec.eventName === "Transfer") {
        const tfer = parseErc20TransferArgs(dec.args);
        if (tfer) {
          gotTransfer = true;
          transfers.push({ token: logAddr, from: tfer.from, to: tfer.to, value: tfer.value });
        }
      }
    } catch {
      /* not standard Transfer */
    }
  }

  return { events, transfers, gotTransfer };
}

function attachTransfers(
  items: ActivityItem[],
  rawByTxIndex: RawTransferRow[][],
  tokenMeta: Map<string, TokenMeta>,
  userAddress: string,
): void {
  const addrLower = userAddress.toLowerCase();
  for (let i = 0; i < items.length; i++) {
    const raw = rawByTxIndex[i] ?? [];
    items[i]!.transfers = raw.map((t) => {
      const info = tokenMeta.get(t.token);
      return {
        token: t.token,
        symbol: info?.symbol ?? "???",
        amount: String(t.value),
        decimals: info?.decimals ?? 18,
        dir: t.from.toLowerCase() === addrLower ? "out" : "in",
      };
    });
  }
}

async function enrichWithDecoding(
  txItems: Array<Record<string, string>>,
  eventsByHash: Map<string, RawEventLog[]>,
  chainId: number,
  userAddress: string,
): Promise<ActivityItem[]> {
  const contractAddrs = collectContractAddresses(txItems, eventsByHash);

  bgLog("[activity] resolving ABIs for", contractAddrs.size, "contracts");
  const abiMap = await resolveAbis(chainId, [...contractAddrs]);
  bgLog("[activity] resolved", abiMap.size, "ABIs");

  const transferTokens = new Set<string>();
  const items: ActivityItem[] = [];
  const rawByTxIndex: RawTransferRow[][] = [];

  for (const tx of txItems) {
    const hash = (tx.hash ?? "").toLowerCase();
    const decoded = decodeTxInput(tx, abiMap);
    const allEvents: DecodedEvent[] = [];
    const rawRows: RawTransferRow[] = [];

    for (const log of eventsByHash.get(hash) ?? []) {
      const { events, transfers } = processLogEntry(log, abiMap);
      allEvents.push(...events);
      for (const t of transfers) {
        transferTokens.add(t.token);
        rawRows.push(t);
      }
    }

    rawByTxIndex.push(rawRows);
    items.push({
      hash: tx.hash ?? "",
      from: tx.from ?? "",
      to: tx.to ?? "",
      value: tx.value ?? "0",
      ts: Number(tx.timeStamp) || 0,
      error: tx.isError === "1",
      method: tx.methodId ?? "",
      fn: decoded?.functionName ?? parseFn(tx.functionName ?? ""),
      block: Number(tx.blockNumber) || 0,
      transfers: [],
      decoded,
      events: allEvents,
    });
  }

  const tokenMeta =
    transferTokens.size > 0
      ? await resolveTokenMeta(chainId, [...transferTokens])
      : new Map<string, TokenMeta>();

  attachTransfers(items, rawByTxIndex, tokenMeta, userAddress);

  const withTransfers = items.filter((i) => i.transfers.length > 0).length;
  const withDecoded = items.filter((i) => i.decoded).length;
  const withEvents = items.filter((i) => i.events.length > 0).length;
  bgLog(
    "[activity] enriched",
    items.length,
    "items:",
    withTransfers,
    "transfers,",
    withDecoded,
    "decoded,",
    withEvents,
    "with events",
  );
  return items;
}

// ── Etherscan flow ──────────────────────────────────────────────────

function basicItemsFromTxlist(txResults: Array<Record<string, string>>): ActivityItem[] {
  return txResults.map((tx) => ({
    hash: tx.hash ?? "",
    from: tx.from ?? "",
    to: tx.to ?? "",
    value: tx.value ?? "0",
    ts: Number(tx.timeStamp) || 0,
    error: tx.isError === "1",
    method: tx.methodId ?? "",
    fn: parseFn(tx.functionName ?? ""),
    block: Number(tx.blockNumber) || 0,
    transfers: [],
    decoded: null,
    events: [],
  }));
}

interface EtherscanPhase1 {
  items: ActivityItem[];
  txResults: Array<Record<string, string>>;
  apiKey: string;
  minBlock: number;
  maxBlock: number;
}

async function fetchEtherscanTxlist(
  address: string,
  chainId: number,
  opts?: { endBlock?: number },
): Promise<EtherscanPhase1 | null> {
  const apiKey = await getEtherscanApiKey();
  if (!apiKey) return null;

  const txlistUrl = new URL(ETHERSCAN_BASE);
  txlistUrl.searchParams.set("chainid", String(chainId));
  txlistUrl.searchParams.set("module", "account");
  txlistUrl.searchParams.set("action", "txlist");
  txlistUrl.searchParams.set("address", address);
  txlistUrl.searchParams.set("startblock", "0");
  txlistUrl.searchParams.set(
    "endblock",
    opts?.endBlock !== undefined ? String(opts.endBlock) : "999999999",
  );
  txlistUrl.searchParams.set("page", "1");
  txlistUrl.searchParams.set("offset", String(FETCH_PAGE_SIZE));
  txlistUrl.searchParams.set("sort", "desc");
  txlistUrl.searchParams.set("apikey", apiKey);

  try {
    bgLog(
      "[activity] etherscan txlist:",
      txlistUrl.toString().replace(/apikey=[^&]+/, "apikey=***"),
    );
    const txResp = await fetch(txlistUrl.toString());
    if (!txResp.ok) return null;

    const txBody = (await txResp.json()) as {
      status?: string;
      message?: string;
      result?: Array<Record<string, string>>;
    };
    bgLog(
      "[activity] txlist status:",
      txBody.status,
      "count:",
      Array.isArray(txBody.result) ? txBody.result.length : "n/a",
    );
    if (txBody.status !== "1" || !Array.isArray(txBody.result) || txBody.result.length === 0)
      return null;

    const minBlock = txBody.result.reduce((m, tx) => {
      const b = Number(tx.blockNumber) || 0;
      return b < m ? b : m;
    }, Number.MAX_SAFE_INTEGER);
    const maxBlock = txBody.result.reduce((m, tx) => {
      const b = Number(tx.blockNumber) || 0;
      return b > m ? b : m;
    }, 0);

    return {
      items: basicItemsFromTxlist(txBody.result),
      txResults: txBody.result,
      apiKey,
      minBlock,
      maxBlock,
    };
  } catch (e) {
    bgLog("[activity] fetchEtherscanTxlist error:", e);
    return null;
  }
}

async function enrichEtherscanAsync(
  address: string,
  chainId: number,
  phase1: EtherscanPhase1,
): Promise<void> {
  try {
    const eventsByHash = await fetchAllEvents(
      address,
      chainId,
      String(phase1.minBlock),
      String(phase1.maxBlock + 1),
      phase1.apiKey,
    );

    const enriched = await enrichWithDecoding(phase1.txResults, eventsByHash, chainId, address);
    const cache = await loadCache();
    const k = actCacheKey(address, chainId);
    const prev = cache[k];
    const merged = dedup([...(prev?.items ?? []), ...enriched]);
    cache[k] = {
      items: merged,
      pendingHashes: [],
      pendingTransfers: {},
      source: "etherscan",
      etherscanHasMore: prev?.etherscanHasMore,
    };
    await persist();

    bgLog("[activity] enrichment complete, broadcasting update");
    browser.runtime
      .sendMessage({
        type: "ACTIVITY_UPDATED",
        items: merged,
        source: "etherscan",
        hasMore: cache[k].etherscanHasMore === true,
      })
      .catch(() => {
        /* popup not open — expected */
      });
  } catch (e) {
    bgLog("[activity] async enrichment error:", e);
  }
}

// ── RPC fallback ─────────────────────────────────────────────────────

interface RpcLog {
  transactionHash: string;
  blockNumber: string;
  address: string;
  topics: string[];
  data: string;
}

function toHex(n: bigint): `0x${string}` {
  return `0x${n.toString(16)}`;
}

async function fetchRpcData(
  address: string,
  chainId: number,
): Promise<{ hashes: string[]; transfersByHash: Record<string, TokenMovement[]> }> {
  const client = getPublicClient(chainId);
  const latest = await getBlockNumber(client);
  const padded = `0x${address.slice(2).toLowerCase().padStart(64, "0")}` as `0x${string}`;

  let allLogs: RpcLog[] = [];
  let blockRange = BigInt(INITIAL_BLOCK_RANGE);
  while (blockRange >= BigInt(MIN_BLOCK_RANGE)) {
    const from = latest - blockRange > 0n ? latest - blockRange : 0n;
    try {
      const [t1, t2] = await Promise.all([
        client.request({
          method: "eth_getLogs",
          params: [
            {
              fromBlock: toHex(from),
              toBlock: toHex(latest),
              topics: [null, padded] as [null, `0x${string}`],
            },
          ],
        }) as Promise<RpcLog[]>,
        client.request({
          method: "eth_getLogs",
          params: [
            {
              fromBlock: toHex(from),
              toBlock: toHex(latest),
              topics: [null, null, padded] as [null, null, `0x${string}`],
            },
          ],
        }) as Promise<RpcLog[]>,
      ]);
      allLogs = [...t1, ...t2];
      break;
    } catch {
      blockRange = blockRange / 2n;
    }
  }

  const seenHash = new Set<string>();
  const hashes: string[] = [];
  for (const log of allLogs) {
    if (log.transactionHash && !seenHash.has(log.transactionHash)) {
      seenHash.add(log.transactionHash);
      hashes.push(log.transactionHash);
    }
  }

  const addrLower = address.toLowerCase();
  const rawTransfers: Array<{
    hash: string;
    token: string;
    from: string;
    to: string;
    value: bigint;
  }> = [];
  for (const log of allLogs) {
    if (!log.topics?.length || log.topics.length !== 3) continue;
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName === "Transfer") {
        const args = decoded.args as { from: string; to: string; value: bigint };
        rawTransfers.push({
          hash: log.transactionHash.toLowerCase(),
          token: log.address,
          from: args.from,
          to: args.to,
          value: args.value,
        });
      }
    } catch {
      /* not a decodable Transfer */
    }
  }

  const uniqueTokens = [...new Set(rawTransfers.map((t) => t.token))];
  const meta =
    uniqueTokens.length > 0
      ? await resolveTokenMeta(chainId, uniqueTokens)
      : new Map<string, TokenMeta>();

  const transfersByHash: Record<string, TokenMovement[]> = {};
  for (const t of rawTransfers) {
    const info = meta.get(t.token.toLowerCase());
    const mv: TokenMovement = {
      token: t.token,
      symbol: info?.symbol ?? "???",
      amount: String(t.value),
      decimals: info?.decimals ?? 18,
      dir: t.from.toLowerCase() === addrLower ? "out" : "in",
    };
    if (!transfersByHash[t.hash]) transfersByHash[t.hash] = [];
    transfersByHash[t.hash]!.push(mv);
  }

  return { hashes: hashes.slice(0, FETCH_PAGE_SIZE), transfersByHash };
}

// ── Enrichment (RPC path) ───────────────────────────────────────────

async function enrichHashes(
  hashes: string[],
  chainId: number,
  transfersByHash: Record<string, TokenMovement[]>,
): Promise<ActivityItem[]> {
  if (hashes.length === 0) return [];
  const client = getPublicClient(chainId);
  const results = await Promise.allSettled(
    hashes.map((h) => getTransaction(client, { hash: h as `0x${string}` })),
  );
  const items: ActivityItem[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const tx = r.value;
    items.push({
      hash: tx.hash,
      from: tx.from,
      to: tx.to ?? "",
      value: String(tx.value),
      ts: Math.floor(Date.now() / 1000),
      error: false,
      method: tx.input?.length >= 10 ? tx.input.slice(0, 10) : "",
      fn: "",
      block: Number(tx.blockNumber ?? 0),
      transfers: transfersByHash[tx.hash.toLowerCase()] ?? [],
      decoded: null,
      events: [],
    });
  }
  return items;
}

// ── Public API ───────────────────────────────────────────────────────

export interface ActivityResult {
  items: ActivityItem[];
  hasMore: boolean;
  source: ActivitySource;
}

export interface FetchActivityOptions {
  /** Fetch next page of older txs (Etherscan only); bypasses refresh rate limit */
  loadMore?: boolean;
}

async function drainPendingHashes(
  entry: CacheEntry,
  cache: Record<string, CacheEntry>,
  k: string,
  chainId: number,
): Promise<ActivityResult> {
  bgLog("[activity] enriching", entry.pendingHashes.length, "pending hashes");
  const batch = entry.pendingHashes.slice(0, ENRICH_BATCH);
  const rest = entry.pendingHashes.slice(ENRICH_BATCH);
  const pt = entry.pendingTransfers ?? {};
  const enriched = await enrichHashes(batch, chainId, pt);
  const cleanPt = { ...pt };
  for (const h of batch) delete cleanPt[h];
  const merged = dedup([...entry.items, ...enriched]);
  cache[k] = { ...entry, items: merged, pendingHashes: rest, pendingTransfers: cleanPt };
  await persist();
  return { items: merged, hasMore: rest.length > 0, source: entry.source };
}

async function fetchOlderEtherscan(
  address: string,
  chainId: number,
  entry: CacheEntry,
  cache: Record<string, CacheEntry>,
  k: string,
): Promise<ActivityResult> {
  if (entry.source !== "etherscan" || !entry.items.length) {
    bgLog("[activity] loadMore: no etherscan cache");
    return {
      items: entry.items,
      hasMore: entry.etherscanHasMore === true,
      source: entry.source ?? "cache",
    };
  }

  const oldest = entry.items.reduce(
    (m, i) => (i.block > 0 && i.block < m ? i.block : m),
    Number.MAX_SAFE_INTEGER,
  );
  if (oldest === Number.MAX_SAFE_INTEGER || oldest <= 1) {
    cache[k] = { ...entry, etherscanHasMore: false };
    await persist();
    return { items: entry.items, hasMore: false, source: "etherscan" };
  }

  const phase1 = await fetchEtherscanTxlist(address, chainId, { endBlock: oldest - 1 });
  if (!phase1 || phase1.txResults.length === 0) {
    cache[k] = { ...entry, etherscanHasMore: false };
    await persist();
    bgLog("[activity] loadMore: no older txs");
    return { items: entry.items, hasMore: false, source: "etherscan" };
  }

  const merged = dedup([...entry.items, ...phase1.items]);
  const fullPage = phase1.txResults.length >= FETCH_PAGE_SIZE;
  cache[k] = {
    ...entry,
    items: merged,
    pendingHashes: [],
    pendingTransfers: {},
    source: "etherscan",
    etherscanHasMore: fullPage,
  };
  await persist();
  enrichEtherscanAsync(address, chainId, phase1).catch((e) => {
    bgLog("[activity] enrichEtherscanAsync (loadMore) failed:", e);
  });
  bgLog("[activity] loadMore merged", merged.length, "items, hasMore:", fullPage);
  return { items: merged, hasMore: fullPage, source: "etherscan" };
}

async function fetchViaRpc(
  address: string,
  chainId: number,
  existingItems: ActivityItem[],
  cache: Record<string, CacheEntry>,
  k: string,
): Promise<ActivityResult> {
  bgLog("[activity] trying rpc fallback...");
  const { hashes, transfersByHash } = await fetchRpcData(address, chainId);
  bgLog(
    "[activity] rpc found",
    hashes.length,
    "hashes,",
    Object.keys(transfersByHash).length,
    "with transfers",
  );
  const existingSet = new Set(existingItems.map((i) => i.hash));
  const newHashes = hashes.filter((h) => !existingSet.has(h));
  const toEnrich = newHashes.slice(0, ENRICH_BATCH);
  const pendingHashes = newHashes.slice(ENRICH_BATCH);
  const enriched = await enrichHashes(toEnrich, chainId, transfersByHash);
  const pendingTransfers: Record<string, TokenMovement[]> = {};
  for (const h of pendingHashes) {
    if (transfersByHash[h]) pendingTransfers[h] = transfersByHash[h];
  }
  const merged = dedup([...existingItems, ...enriched]);
  cache[k] = {
    items: merged,
    pendingHashes,
    pendingTransfers,
    source: "rpc",
    etherscanHasMore: false,
  };
  await persist();
  return { items: merged, hasMore: pendingHashes.length > 0, source: "rpc" };
}

export async function fetchActivity(
  address: string,
  chainId: number,
  opts?: FetchActivityOptions,
): Promise<ActivityResult> {
  const loadMore = opts?.loadMore === true;
  bgLog("[activity] fetchActivity", loadMore ? "loadMore" : "refresh", address, "chain", chainId);
  const cache = await loadCache();
  const k = actCacheKey(address, chainId);
  const entry = cache[k];

  if (entry?.pendingHashes.length) {
    return drainPendingHashes(entry, cache, k, chainId);
  }

  if (!loadMore) {
    const lastTs = lastFetchTs.get(k) ?? 0;
    if (Date.now() - lastTs < RATE_LIMIT_MS && entry) {
      bgLog("[activity] rate-limited, returning", entry.items.length, "cached items");
      const hasMore = entry.etherscanHasMore === true || (entry.pendingHashes?.length ?? 0) > 0;
      return { items: entry.items, hasMore, source: "cache" };
    }
    lastFetchTs.set(k, Date.now());
  }

  if (loadMore && entry) {
    return fetchOlderEtherscan(address, chainId, entry, cache, k);
  }

  try {
    bgLog("[activity] trying etherscan...");
    const phase1 = await fetchEtherscanTxlist(address, chainId);
    if (phase1) {
      bgLog("[activity] etherscan txlist returned", phase1.items.length, "items, enriching async");
      const merged = dedup([...(entry?.items ?? []), ...phase1.items]);
      const fullPage = phase1.txResults.length >= FETCH_PAGE_SIZE;
      cache[k] = {
        items: merged,
        pendingHashes: [],
        pendingTransfers: {},
        source: "etherscan",
        etherscanHasMore: fullPage,
      };
      await persist();
      enrichEtherscanAsync(address, chainId, phase1).catch((e) => {
        bgLog("[activity] enrichEtherscanAsync failed:", e);
      });
      return { items: merged, hasMore: fullPage, source: "etherscan" };
    }
    bgLog("[activity] etherscan returned null, falling back to rpc");
  } catch (e) {
    bgLog("[activity] etherscan exception:", e);
  }

  try {
    return await fetchViaRpc(address, chainId, entry?.items ?? [], cache, k);
  } catch (e) {
    bgLog("[activity] rpc exception:", e);
  }

  bgLog("[activity] all paths failed, returning cache");
  return {
    items: entry?.items ?? [],
    hasMore: entry?.etherscanHasMore === true || (entry?.pendingHashes?.length ?? 0) > 0,
    source: "cache",
  };
}

export async function pushActivityItem(
  address: string,
  chainId: number,
  item: ActivityItem,
): Promise<void> {
  const cache = await loadCache();
  const k = actCacheKey(address, chainId);
  const entry = cache[k] ?? {
    items: [],
    pendingHashes: [],
    pendingTransfers: {},
    source: "cache" as ActivitySource,
  };
  entry.items = dedup([item, ...entry.items]);
  cache[k] = entry;
  await persist();
}

export async function clearActivityCache(): Promise<void> {
  lastFetchTs.clear();
  await activityStore.clearStorage();
  await tokenMetaStore.clearStorage();
}
