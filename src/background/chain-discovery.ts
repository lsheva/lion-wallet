import type { Address } from "viem";
import { getBalance, getTransactionCount } from "viem/actions";
import { HD_DERIVATION_DEFAULT_CEILING } from "../shared/hd-constants";
import type { SerializedAccount } from "../shared/types";
import { broadcastEvent } from "./broadcast";
import type { HdDerivedAddressMap } from "./hd-addresses";
import { serializedAccountForSlot } from "./hd-addresses";
import { getPublicClient } from "./networks";
import type { AccountsMeta } from "./vault";
import { saveAccountsMeta } from "./vault";

export interface ChainDiscoveryResult {
  activeAccountIndices: number[];
  scannedAt: number;
}

/** Avoid burst RPC (e.g. 20× balance + nonce) that triggers public endpoint rate limits. */
const CHAIN_DISCOVERY_RPC_CONCURRENCY = 4;

async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const runWorker = async () => {
    while (next < items.length) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i]!, i);
    }
  };
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => runWorker()));
}

async function rpcActivity(
  chainId: number,
  address: Address,
): Promise<{ balance: bigint; nonce: bigint }> {
  const client = getPublicClient(chainId);
  const [balance, nonce] = await Promise.all([
    getBalance(client, { address }),
    getTransactionCount(client, { address }),
  ]);
  return { balance, nonce: BigInt(nonce) };
}

function hasOnChainActivity(balance: bigint, nonce: bigint): boolean {
  return balance > 0n || nonce > 0n;
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

    for (const [keyringId, addresses] of Object.entries(hdAddressMap)) {
      const slotActive: boolean[] = new Array(HD_DERIVATION_DEFAULT_CEILING).fill(false);
      await Promise.all(
        addresses.map(async (address, i) => {
          const { balance, nonce } = await rpcActivity(chainId, address);
          const discovered = hasOnChainActivity(balance, nonce);
          slotActive[i] = i === 0 || discovered;

          let m = hdByKeyringIndex.get(keyringId);
          if (!m) {
            m = new Map();
            hdByKeyringIndex.set(keyringId, m);
          }
          if (discovered && !m.has(i)) {
            m.set(i, serializedAccountForSlot(i, address, keyringId));
          }
        }),
      );
      slotActiveByKeyring.set(keyringId, slotActive);
    }

    const updatedAccounts = mergeAccountList(
      hdByKeyringIndex,
      imported,
      meta.keyrings.map((k) => k.id),
    );
    const prevAddr = meta.activeAccountAddress;
    let newActiveAddr = meta.activeAccountAddress;
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

    const changed =
      updatedAccounts.length !== meta.accounts.length ||
      updatedAccounts.some((a, i) => a.address !== meta.accounts[i]?.address);
    const activeChanged = newActiveAddr !== meta.activeAccountAddress;

    if (changed || activeChanged) {
      await saveAccountsMeta(updatedAccounts, newActiveAddr, meta.keyrings);
      broadcastEvent(
        "accountsChanged",
        updatedAccounts.map((a) => a.address),
      );
    }

    return { activeAccountIndices, scannedAt: now };
  }

  /** No per-keyring list: scan only addresses already in `accounts`. */
  const hd = meta.accounts.filter((a) => a.path !== "imported");
  const slotActive = new Map<string, boolean>();

  await runPool(hd, CHAIN_DISCOVERY_RPC_CONCURRENCY, async (a) => {
    const { balance, nonce } = await rpcActivity(chainId, a.address);
    const active = a.index === 0 || hasOnChainActivity(balance, nonce);
    slotActive.set(`${a.keyringId}:${a.index}`, active);
  });

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
