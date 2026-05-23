/**
 * Per-chain "which derived addresses have activity" scan.
 *
 * Triggered lazily from the popup via `ENSURE_CHAIN_DISCOVERY` when the user
 * opens a chain. For each HD address up to `HD_DERIVATION_DEFAULT_CEILING`,
 * checks balance and transaction count; reports back the indices that are
 * "active" so Home can hide empty derivations. Streams progress via
 * `notifyChainDiscoveryProgress` so the UI updates incrementally.
 */
import type { Address } from "viem";
import { getBalance, getTransactionCount } from "viem/actions";
import { HD_DERIVATION_DEFAULT_CEILING } from "../shared/hd-constants";

import type { SerializedAccount } from "../shared/types";
import { visibleAccounts } from "./account-utils";
import { broadcastEvent, notifyChainDiscoveryProgress } from "./broadcast";
import type { HdDerivedAddressMap } from "./hd-addresses";
import { serializedAccountForSlot } from "./hd-addresses";
import { bgLog } from "./log";
import { getPublicClient } from "./networks";
import type { AccountsMeta } from "./vault";
import { saveAccountsMeta } from "./vault";

/** Stop scanning further derivation indices after this many consecutive zero-balance, zero-nonce accounts. */
const DISCOVERY_CONSECUTIVE_EMPTY_LIMIT = 3;

export interface ChainDiscoveryResult {
  activeAccountIndices: number[];
  scannedAt: number;
}

type HdDiscoveryTask = { keyringId: string; index: number; address: Address };

export async function runChainDiscovery(
  chainId: number,
  meta: AccountsMeta,
  hdAddressMap: HdDerivedAddressMap | null,
): Promise<ChainDiscoveryResult> {
  const now = Date.now();
  const imported = meta.accounts.filter((a) => a.path === "imported");

  if (hdAddressMap && Object.keys(hdAddressMap).length > 0) {
    return discoverFromHdAddressMap(chainId, meta, imported, hdAddressMap, now);
  }

  return discoverKnownAccountsOnly(chainId, meta, now);
}

function seenActivitySet(meta: AccountsMeta): Set<string> {
  return new Set(meta.discoverySeenActivityAddresses ?? []);
}

function mergeSeenAddress(current: string[] | undefined, address: Address): string[] {
  const lower = address.toLowerCase();
  const s = new Set(current ?? []);
  s.add(lower);
  return [...s];
}

async function rpcActivity(
  chainId: number,
  address: Address,
): Promise<{ balance: bigint; nonce: bigint }> {
  const client = getPublicClient(chainId);
  try {
    bgLog("[chain-discovery] rpcActivity started:", chainId, address);
    const [balance, nonce] = await Promise.all([
      getBalance(client, { address }),
      getTransactionCount(client, { address }),
    ]);
    return { balance, nonce: BigInt(nonce) };
  } catch (e) {
    bgLog("[chain-discovery] rpcActivity failed:", e);
    throw e;
  }
}

function hasOnChainActivity(balance: bigint, nonce: bigint): boolean {
  return balance > 0n || nonce > 0n;
}

function metaFingerprint(
  accounts: SerializedAccount[],
  active: Address,
  seenActivity: string[],
): string {
  return JSON.stringify({
    addrs: accounts.map((a) => a.address.toLowerCase()),
    hidden: accounts.map((a) => Boolean(a.hidden)),
    active: active.toLowerCase(),
    seen: seenActivity,
  });
}

/** Merge HD accounts (by keyring + derivation index) with imported accounts; HD sorted per keyring, imported last. */
function mergeAccountList(
  hdByKeyringIndex: Map<string, Map<number, SerializedAccount>>,
  imported: SerializedAccount[],
  keyringOrderHint: string[],
) {
  const orderedIds = [...keyringOrderHint];
  for (const kid of hdByKeyringIndex.keys()) {
    if (!orderedIds.includes(kid)) orderedIds.push(kid);
  }
  const hdSorted: SerializedAccount[] = [];
  for (const kid of orderedIds) {
    const m = hdByKeyringIndex.get(kid);
    if (!m) continue;
    const indices = [...m.keys()].sort((a, b) => a - b);
    for (const i of indices) {
      const acc = m.get(i);
      if (acc) hdSorted.push(acc);
    }
  }
  return [...hdSorted, ...imported];
}

function hdSlotActiveForVisibleAccount(
  acc: SerializedAccount,
  slotActive: boolean,
  seen: Set<string>,
): boolean {
  if (acc.path === "imported") return true;
  if (acc.index > 0) return true;
  if (acc.index === 0 && seen.has(acc.address.toLowerCase())) return true;
  const slots = slotActive;
  return slots;
}

function computeHdDiscoverySnapshot(
  hdByKeyringIndex: Map<string, Map<number, SerializedAccount>>,
  slotActiveByKeyring: Map<string, boolean[]>,
  imported: SerializedAccount[],
  keyringOrderHint: string[],
  initialActiveAddress: Address,
  seen: Set<string>,
): {
  updatedAccounts: SerializedAccount[];
  activeAccountIndices: number[];
  newActiveAddr: Address;
} {
  const updatedAccounts = mergeAccountList(hdByKeyringIndex, imported, keyringOrderHint);
  const visibleOrdered = visibleAccounts(updatedAccounts);
  const prevAddr = initialActiveAddress;
  let newActiveAddr = initialActiveAddress;
  if (prevAddr) {
    const idx = visibleOrdered.findIndex((a) => a.address === prevAddr);
    const picked = idx >= 0 ? visibleOrdered[idx]?.address : visibleOrdered[0]?.address;
    if (picked !== undefined) {
      newActiveAddr = picked;
    }
  }

  const activeAccountIndices: number[] = [];
  for (let j = 0; j < visibleOrdered.length; j++) {
    const acc = visibleOrdered[j];
    if (!acc) continue;
    if (acc.path === "imported") {
      activeAccountIndices.push(j);
      continue;
    }
    const i = acc.index;
    const slots = slotActiveByKeyring.get(acc.keyringId);
    const slotVal =
      slots && i >= 0 && i < HD_DERIVATION_DEFAULT_CEILING ? Boolean(slots[i]) : false;
    if (i >= HD_DERIVATION_DEFAULT_CEILING) {
      activeAccountIndices.push(j);
    } else if (hdSlotActiveForVisibleAccount(acc, slotVal, seen)) {
      activeAccountIndices.push(j);
    }
  }
  return { updatedAccounts, activeAccountIndices, newActiveAddr };
}

function hdAccountsByKeyringFromMeta(
  meta: AccountsMeta,
): Map<string, Map<number, SerializedAccount>> {
  const hdByKeyringIndex = new Map<string, Map<number, SerializedAccount>>();
  for (const a of meta.accounts) {
    if (a.path === "imported") continue;
    const m = hdByKeyringIndex.get(a.keyringId) ?? new Map<number, SerializedAccount>();
    m.set(a.index, a);
    hdByKeyringIndex.set(a.keyringId, m);
  }
  return hdByKeyringIndex;
}

function tasksAndSlotArraysFromHdMap(hdAddressMap: HdDerivedAddressMap): {
  tasks: HdDiscoveryTask[];
  slotActiveByKeyring: Map<string, boolean[]>;
} {
  const slotActiveByKeyring = new Map<string, boolean[]>();
  const tasks: HdDiscoveryTask[] = [];
  for (const [keyringId, addresses] of Object.entries(hdAddressMap)) {
    slotActiveByKeyring.set(keyringId, new Array(HD_DERIVATION_DEFAULT_CEILING).fill(false));
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      if (address) tasks.push({ keyringId, index: i, address });
    }
  }
  return { tasks, slotActiveByKeyring };
}

function recordHdSlotActive(
  keyringId: string,
  index: number,
  discovered: boolean,
  slotActiveByKeyring: Map<string, boolean[]>,
): void {
  const slots = slotActiveByKeyring.get(keyringId);
  if (!slots || index < 0 || index >= slots.length) return;
  slots[index] = index === 0 || discovered;
}

function ensureSerializedAccountForDiscoveredSlot(
  hdByKeyringIndex: Map<string, Map<number, SerializedAccount>>,
  keyringId: string,
  index: number,
  address: Address,
  discovered: boolean,
): void {
  if (!discovered) return;
  const existing = hdByKeyringIndex.get(keyringId)?.get(index);
  if (existing?.hidden) return;
  let m = hdByKeyringIndex.get(keyringId);
  if (!m) {
    m = new Map();
    hdByKeyringIndex.set(keyringId, m);
  }
  if (!m.has(index)) {
    m.set(index, serializedAccountForSlot(index, address, keyringId));
  }
}

function updateEmptySlotStreak(
  keyringId: string,
  discovered: boolean,
  consecutiveNoActivityByKeyring: Map<string, number>,
  keyringDiscoveryExhausted: Map<string, boolean>,
): void {
  if (discovered) {
    consecutiveNoActivityByKeyring.set(keyringId, 0);
    return;
  }
  const streak = (consecutiveNoActivityByKeyring.get(keyringId) ?? 0) + 1;
  consecutiveNoActivityByKeyring.set(keyringId, streak);
  if (streak >= DISCOVERY_CONSECUTIVE_EMPTY_LIMIT) {
    keyringDiscoveryExhausted.set(keyringId, true);
  }
}

function seedSlotsFromMeta(
  meta: AccountsMeta,
  slotActiveByKeyring: Map<string, boolean[]>,
  seen: Set<string>,
): void {
  for (const a of meta.accounts) {
    if (a.path === "imported" || a.hidden) continue;
    const slots = slotActiveByKeyring.get(a.keyringId);
    if (!slots || a.index < 0 || a.index >= slots.length) continue;
    if (a.index > 0 || (a.index === 0 && seen.has(a.address.toLowerCase()))) {
      slots[a.index] = true;
    }
  }
}

/** Queues UI updates and serializes vault persistence when account list or active address changes. */
function createHdDiscoveryPersistNotifier(
  chainId: number,
  meta: AccountsMeta,
  imported: SerializedAccount[],
  keyringOrderHint: string[],
  hdByKeyringIndex: Map<string, Map<number, SerializedAccount>>,
  slotActiveByKeyring: Map<string, boolean[]>,
  seenActivityAddresses: string[],
) {
  let lastPersistedFp = metaFingerprint(
    meta.accounts,
    meta.activeAccountAddress,
    seenActivityAddresses,
  );
  let persistChain = Promise.resolve();
  let mutableSeen = [...seenActivityAddresses];

  const notifyProgressAndMaybePersist = () => {
    const snap = computeHdDiscoverySnapshot(
      hdByKeyringIndex,
      slotActiveByKeyring,
      imported,
      keyringOrderHint,
      meta.activeAccountAddress,
      new Set(mutableSeen),
    );
    notifyChainDiscoveryProgress(chainId, snap.activeAccountIndices);

    const fp = metaFingerprint(snap.updatedAccounts, snap.newActiveAddr, mutableSeen);
    if (fp === lastPersistedFp) return;

    persistChain = persistChain.then(async () => {
      try {
        const latest = computeHdDiscoverySnapshot(
          hdByKeyringIndex,
          slotActiveByKeyring,
          imported,
          keyringOrderHint,
          meta.activeAccountAddress,
          new Set(mutableSeen),
        );
        const latestFp = metaFingerprint(latest.updatedAccounts, latest.newActiveAddr, mutableSeen);
        if (latestFp === lastPersistedFp) return;
        await saveAccountsMeta(
          latest.updatedAccounts,
          latest.newActiveAddr,
          meta.keyrings,
          mutableSeen,
        );
        lastPersistedFp = latestFp;
        broadcastEvent(
          "accountsChanged",
          visibleAccounts(latest.updatedAccounts).map((a) => a.address),
        );
      } catch (e) {
        bgLog("[chain-discovery] persist failed:", e);
      }
    });
  };

  return {
    notifyProgressAndMaybePersist,
    flushPersist: () => persistChain,
    appendSeen: (addr: Address) => {
      mutableSeen = mergeSeenAddress(mutableSeen, addr);
    },
    getSeenSnapshot: () => mutableSeen,
  };
}

async function discoverFromHdAddressMap(
  chainId: number,
  meta: AccountsMeta,
  imported: SerializedAccount[],
  hdAddressMap: HdDerivedAddressMap,
  scannedAt: number,
): Promise<ChainDiscoveryResult> {
  const hdByKeyringIndex = hdAccountsByKeyringFromMeta(meta);
  const { tasks, slotActiveByKeyring } = tasksAndSlotArraysFromHdMap(hdAddressMap);
  const keyringOrderHint = meta.keyrings.map((k) => k.id);
  const seenArr = [...(meta.discoverySeenActivityAddresses ?? [])];
  const seen = seenActivitySet(meta);

  seedSlotsFromMeta(meta, slotActiveByKeyring, seen);

  const consecutiveNoActivityByKeyring = new Map<string, number>();
  const keyringDiscoveryExhausted = new Map<string, boolean>();

  const { notifyProgressAndMaybePersist, flushPersist, appendSeen, getSeenSnapshot } =
    createHdDiscoveryPersistNotifier(
      chainId,
      meta,
      imported,
      keyringOrderHint,
      hdByKeyringIndex,
      slotActiveByKeyring,
      seenArr,
    );

  for (const { keyringId, index: i, address } of tasks) {
    if (keyringDiscoveryExhausted.get(keyringId)) continue;

    const metaAcc = hdByKeyringIndex.get(keyringId)?.get(i);
    if (metaAcc?.hidden) continue;

    if (metaAcc && !metaAcc.hidden && metaAcc.index > 0) {
      recordHdSlotActive(keyringId, i, true, slotActiveByKeyring);
      updateEmptySlotStreak(
        keyringId,
        true,
        consecutiveNoActivityByKeyring,
        keyringDiscoveryExhausted,
      );
      notifyProgressAndMaybePersist();
      continue;
    }

    if (metaAcc && !metaAcc.hidden && metaAcc.index === 0 && seen.has(address.toLowerCase())) {
      recordHdSlotActive(keyringId, i, true, slotActiveByKeyring);
      updateEmptySlotStreak(
        keyringId,
        true,
        consecutiveNoActivityByKeyring,
        keyringDiscoveryExhausted,
      );
      notifyProgressAndMaybePersist();
      continue;
    }

    const { balance, nonce } = await rpcActivity(chainId, address);
    const discovered = hasOnChainActivity(balance, nonce);

    if (discovered && metaAcc && !metaAcc.hidden && metaAcc.index === 0) {
      appendSeen(address);
      seen.add(address.toLowerCase());
    }

    recordHdSlotActive(keyringId, i, discovered, slotActiveByKeyring);
    ensureSerializedAccountForDiscoveredSlot(hdByKeyringIndex, keyringId, i, address, discovered);
    updateEmptySlotStreak(
      keyringId,
      discovered,
      consecutiveNoActivityByKeyring,
      keyringDiscoveryExhausted,
    );

    notifyProgressAndMaybePersist();
  }

  await flushPersist();

  const finalSeen = new Set(getSeenSnapshot());
  const final = computeHdDiscoverySnapshot(
    hdByKeyringIndex,
    slotActiveByKeyring,
    imported,
    keyringOrderHint,
    meta.activeAccountAddress,
    finalSeen,
  );
  return { activeAccountIndices: final.activeAccountIndices, scannedAt };
}

function activeIndicesFromMetaAndSlotLookup(
  meta: AccountsMeta,
  slotActive: Map<string, boolean>,
  seen: Set<string>,
): number[] {
  const visible = visibleAccounts(meta.accounts);
  const activeAccountIndices: number[] = [];
  for (let j = 0; j < visible.length; j++) {
    const acc = visible[j];
    if (!acc) continue;
    if (acc.path === "imported") {
      activeAccountIndices.push(j);
      continue;
    }
    const slotOk = slotActive.get(`${acc.keyringId}:${acc.index}`) ?? false;
    if (hdSlotActiveForVisibleAccount(acc, slotOk, seen)) activeAccountIndices.push(j);
  }
  return activeAccountIndices;
}

async function discoverKnownAccountsOnly(
  chainId: number,
  meta: AccountsMeta,
  scannedAt: number,
): Promise<ChainDiscoveryResult> {
  const hd = meta.accounts.filter((a) => a.path !== "imported" && !a.hidden);
  const slotActive = new Map<string, boolean>();
  const seenArr = meta.discoverySeenActivityAddresses ?? [];
  const seenSet = new Set(seenArr);
  let seenMut = [...seenArr];

  const emitProgress = () => {
    notifyChainDiscoveryProgress(
      chainId,
      activeIndicesFromMetaAndSlotLookup(meta, slotActive, seenSet),
    );
  };

  for (const a of hd) {
    if (a.index > 0 || (a.index === 0 && seenSet.has(a.address.toLowerCase()))) {
      slotActive.set(`${a.keyringId}:${a.index}`, true);
      emitProgress();
      continue;
    }

    const { balance, nonce } = await rpcActivity(chainId, a.address);
    const discovered = hasOnChainActivity(balance, nonce);
    const active = a.index === 0 || discovered;
    slotActive.set(`${a.keyringId}:${a.index}`, active);
    if (discovered && a.index === 0) {
      seenMut = mergeSeenAddress(seenMut, a.address);
      seenSet.add(a.address.toLowerCase());
    }
    emitProgress();
  }

  const seenBefore = meta.discoverySeenActivityAddresses ?? [];
  const seenChanged =
    seenMut.length !== seenBefore.length || seenMut.some((x, i) => x !== seenBefore[i]);
  if (seenChanged) {
    await saveAccountsMeta(meta.accounts, meta.activeAccountAddress, meta.keyrings, seenMut);
    broadcastEvent(
      "accountsChanged",
      visibleAccounts(meta.accounts).map((a) => a.address),
    );
  }

  return {
    activeAccountIndices: activeIndicesFromMetaAndSlotLookup(meta, slotActive, seenSet),
    scannedAt,
  };
}
