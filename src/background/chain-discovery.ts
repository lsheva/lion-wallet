import type { Address } from "viem";
import { getBalance, getTransactionCount } from "viem/actions";
import { HD_DERIVATION_DEFAULT_CEILING } from "../shared/hd-constants";

/** Stop scanning further derivation indices after this many consecutive zero-balance, zero-nonce accounts. */
const DISCOVERY_CONSECUTIVE_EMPTY_LIMIT = 3;

import type { SerializedAccount } from "../shared/types";
import { broadcastEvent, notifyChainDiscoveryProgress } from "./broadcast";
import type { HdDerivedAddressMap } from "./hd-addresses";
import { serializedAccountForSlot } from "./hd-addresses";
import { bgLog } from "./log";
import { getPublicClient } from "./networks";
import type { AccountsMeta } from "./vault";
import { saveAccountsMeta } from "./vault";

export interface ChainDiscoveryResult {
  activeAccountIndices: number[];
  scannedAt: number;
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

function metaFingerprint(accounts: SerializedAccount[], active: Address): string {
  return JSON.stringify({
    addrs: accounts.map((a) => a.address.toLowerCase()),
    active: active.toLowerCase(),
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

function computeHdDiscoverySnapshot(
  hdByKeyringIndex: Map<string, Map<number, SerializedAccount>>,
  slotActiveByKeyring: Map<string, boolean[]>,
  imported: SerializedAccount[],
  keyringOrderHint: string[],
  initialActiveAddress: Address,
): {
  updatedAccounts: SerializedAccount[];
  activeAccountIndices: number[];
  newActiveAddr: Address;
} {
  const updatedAccounts = mergeAccountList(hdByKeyringIndex, imported, keyringOrderHint);
  const prevAddr = initialActiveAddress;
  let newActiveAddr = initialActiveAddress;
  if (prevAddr) {
    const idx = updatedAccounts.findIndex((a) => a.address === prevAddr);
    const picked = idx >= 0 ? updatedAccounts[idx]?.address : updatedAccounts[0]?.address;
    if (picked !== undefined) {
      newActiveAddr = picked;
    }
  }

  const activeAccountIndices: number[] = [];
  for (let j = 0; j < updatedAccounts.length; j++) {
    const acc = updatedAccounts[j];
    if (!acc) continue;
    if (acc.path === "imported") {
      activeAccountIndices.push(j);
      continue;
    }
    const i = acc.index;
    const slots = slotActiveByKeyring.get(acc.keyringId);
    if (i >= HD_DERIVATION_DEFAULT_CEILING) {
      activeAccountIndices.push(j);
    } else if (slots && i >= 0 && i < HD_DERIVATION_DEFAULT_CEILING && slots[i]) {
      activeAccountIndices.push(j);
    }
  }
  return { updatedAccounts, activeAccountIndices, newActiveAddr };
}

export async function runChainDiscovery(
  chainId: number,
  meta: AccountsMeta,
  hdAddressMap: HdDerivedAddressMap | null,
): Promise<ChainDiscoveryResult> {
  const now = Date.now();
  const imported = meta.accounts.filter((a) => a.path === "imported");

  if (hdAddressMap && Object.keys(hdAddressMap).length > 0) {
    const hdByKeyringIndex = new Map<string, Map<number, SerializedAccount>>();
    for (const a of meta.accounts) {
      if (a.path === "imported") continue;
      const m = hdByKeyringIndex.get(a.keyringId) ?? new Map<number, SerializedAccount>();
      m.set(a.index, a);
      hdByKeyringIndex.set(a.keyringId, m);
    }

    const slotActiveByKeyring = new Map<string, boolean[]>();
    const tasks: { keyringId: string; index: number; address: Address }[] = [];
    for (const [keyringId, addresses] of Object.entries(hdAddressMap)) {
      slotActiveByKeyring.set(keyringId, new Array(HD_DERIVATION_DEFAULT_CEILING).fill(false));
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        if (address) tasks.push({ keyringId, index: i, address });
      }
    }

    const keyringOrderHint = meta.keyrings.map((k) => k.id);
    let lastPersistedFp = metaFingerprint(meta.accounts, meta.activeAccountAddress);
    let persistChain = Promise.resolve();

    const consecutiveNoActivityByKeyring = new Map<string, number>();
    const keyringDiscoveryExhausted = new Map<string, boolean>();

    const emitHdProgress = () => {
      const snap = computeHdDiscoverySnapshot(
        hdByKeyringIndex,
        slotActiveByKeyring,
        imported,
        keyringOrderHint,
        meta.activeAccountAddress,
      );
      notifyChainDiscoveryProgress(chainId, snap.activeAccountIndices);

      const fp = metaFingerprint(snap.updatedAccounts, snap.newActiveAddr);
      if (fp === lastPersistedFp) return;

      persistChain = persistChain.then(async () => {
        try {
          const latest = computeHdDiscoverySnapshot(
            hdByKeyringIndex,
            slotActiveByKeyring,
            imported,
            keyringOrderHint,
            meta.activeAccountAddress,
          );
          const latestFp = metaFingerprint(latest.updatedAccounts, latest.newActiveAddr);
          if (latestFp === lastPersistedFp) return;
          await saveAccountsMeta(latest.updatedAccounts, latest.newActiveAddr, meta.keyrings);
          lastPersistedFp = latestFp;
          broadcastEvent(
            "accountsChanged",
            latest.updatedAccounts.map((a) => a.address),
          );
        } catch (e) {
          bgLog("[chain-discovery] persist failed:", e);
        }
      });
    };

    for (const { keyringId, index: i, address } of tasks) {
      if (keyringDiscoveryExhausted.get(keyringId)) continue;

      const { balance, nonce } = await rpcActivity(chainId, address);
      const discovered = hasOnChainActivity(balance, nonce);
      const slots = slotActiveByKeyring.get(keyringId);
      if (slots && i >= 0 && i < slots.length) {
        slots[i] = i === 0 || discovered;
      }

      let m = hdByKeyringIndex.get(keyringId);
      if (!m) {
        m = new Map();
        hdByKeyringIndex.set(keyringId, m);
      }
      if (discovered && !m.has(i)) {
        m.set(i, serializedAccountForSlot(i, address, keyringId));
      }

      if (discovered) {
        consecutiveNoActivityByKeyring.set(keyringId, 0);
      } else {
        const streak = (consecutiveNoActivityByKeyring.get(keyringId) ?? 0) + 1;
        consecutiveNoActivityByKeyring.set(keyringId, streak);
        if (streak >= DISCOVERY_CONSECUTIVE_EMPTY_LIMIT) {
          keyringDiscoveryExhausted.set(keyringId, true);
        }
      }

      emitHdProgress();
    }

    await persistChain;

    const final = computeHdDiscoverySnapshot(
      hdByKeyringIndex,
      slotActiveByKeyring,
      imported,
      keyringOrderHint,
      meta.activeAccountAddress,
    );
    return { activeAccountIndices: final.activeAccountIndices, scannedAt: now };
  }

  /** No per-keyring list: scan only addresses already in `accounts`. */
  const hd = meta.accounts.filter((a) => a.path !== "imported");
  const slotActive = new Map<string, boolean>();

  const emitFallback = () => {
    const activeAccountIndices: number[] = [];
    for (let j = 0; j < meta.accounts.length; j++) {
      const acc = meta.accounts[j];
      if (!acc) continue;
      if (acc.path === "imported") {
        activeAccountIndices.push(j);
        continue;
      }
      if (slotActive.get(`${acc.keyringId}:${acc.index}`)) activeAccountIndices.push(j);
    }
    notifyChainDiscoveryProgress(chainId, activeAccountIndices);
  };

  for (const a of hd) {
    const { balance, nonce } = await rpcActivity(chainId, a.address);
    const active = a.index === 0 || hasOnChainActivity(balance, nonce);
    slotActive.set(`${a.keyringId}:${a.index}`, active);
    emitFallback();
  }

  const activeAccountIndices: number[] = [];
  for (let j = 0; j < meta.accounts.length; j++) {
    const acc = meta.accounts[j];
    if (!acc) continue;
    if (acc.path === "imported") {
      activeAccountIndices.push(j);
      continue;
    }
    if (slotActive.get(`${acc.keyringId}:${acc.index}`)) activeAccountIndices.push(j);
  }

  return { activeAccountIndices, scannedAt: now };
}
