import type { Address } from "viem";
import { getBalance, getTransactionCount } from "viem/actions";
import { HD_DERIVATION_DEFAULT_CEILING } from "../shared/hd-constants";
import type { SerializedAccount } from "../shared/types";
import { broadcastEvent } from "./broadcast";
import { serializedAccountForSlot } from "./hd-addresses";
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
  const [balance, nonce] = await Promise.all([
    getBalance(client, { address }),
    getTransactionCount(client, { address }),
  ]);
  return { balance, nonce: BigInt(nonce) };
}

function hasOnChainActivity(balance: bigint, nonce: bigint): boolean {
  return balance > 0n || nonce > 0n;
}

/** Merge HD accounts (by derivation index) with imported accounts; HD sorted by index, imported last. */
function mergeAccountList(hdByIndex: Map<number, SerializedAccount>, imported: SerializedAccount[]) {
  const hdSorted = [...hdByIndex.values()].sort((a, b) => a.index - b.index);
  return [...hdSorted, ...imported];
}

export async function runChainDiscovery(
  chainId: number,
  meta: AccountsMeta,
  hdAddresses: Address[] | null,
): Promise<ChainDiscoveryResult> {
  const now = Date.now();
  const imported = meta.accounts.filter((a) => a.path === "imported");

  if (hdAddresses) {
    const hdByIndex = new Map<number, SerializedAccount>();
    for (const a of meta.accounts) {
      if (a.path !== "imported") hdByIndex.set(a.index, a);
    }

    /** Per-slot activity on this chain (fresh RPC every time). */
    const slotActive: boolean[] = new Array(HD_DERIVATION_DEFAULT_CEILING).fill(false);

    await Promise.all(
      hdAddresses.map(async (address, i) => {
        const { balance, nonce } = await rpcActivity(chainId, address);
        const active = i === 0 || hasOnChainActivity(balance, nonce);
        slotActive[i] = active;

        const discovered = hasOnChainActivity(balance, nonce);
        if (discovered && !hdByIndex.has(i)) {
          hdByIndex.set(i, serializedAccountForSlot(i, address));
        }
      }),
    );

    const updatedAccounts = mergeAccountList(hdByIndex, imported);
    const prevActive = meta.accounts[meta.activeAccountIndex];
    const prevAddr = prevActive?.address;

    let newActiveIdx = meta.activeAccountIndex;
    if (prevAddr) {
      const idx = updatedAccounts.findIndex((a) => a.address === prevAddr);
      newActiveIdx = idx >= 0 ? idx : 0;
    }

    /** Home: show accounts active on this chain (index 0 always). */
    const activeAccountIndices: number[] = [];
    for (let j = 0; j < updatedAccounts.length; j++) {
      const acc = updatedAccounts[j];
      if (!acc) continue;
      if (acc.path === "imported") {
        activeAccountIndices.push(j);
        continue;
      }
      const i = acc.index;
      if (i >= HD_DERIVATION_DEFAULT_CEILING) {
        activeAccountIndices.push(j);
      } else if (i >= 0 && i < HD_DERIVATION_DEFAULT_CEILING && slotActive[i]) {
        activeAccountIndices.push(j);
      }
    }

    if (
      updatedAccounts.length !== meta.accounts.length ||
      updatedAccounts.some((a, i) => a.address !== meta.accounts[i]?.address)
    ) {
      await saveAccountsMeta(updatedAccounts, newActiveIdx);
      broadcastEvent(
        "accountsChanged",
        updatedAccounts.map((a) => a.address),
      );
    } else if (newActiveIdx !== meta.activeAccountIndex) {
      await saveAccountsMeta(updatedAccounts, newActiveIdx);
      broadcastEvent(
        "accountsChanged",
        updatedAccounts.map((a) => a.address),
      );
    }

    return { activeAccountIndices, scannedAt: now };
  }

  /** No 20-slot list: scan only addresses already in `accounts` (legacy / vault without migration). */
  const hd = meta.accounts.filter((a) => a.path !== "imported");
  const slotActive = new Map<number, boolean>();

  await Promise.all(
    hd.map(async (a) => {
      const { balance, nonce } = await rpcActivity(chainId, a.address);
      const active = a.index === 0 || hasOnChainActivity(balance, nonce);
      slotActive.set(a.index, active);
    }),
  );

  const activeAccountIndices: number[] = [];
  for (let j = 0; j < meta.accounts.length; j++) {
    const acc = meta.accounts[j];
    if (!acc) continue;
    if (acc.path === "imported") {
      activeAccountIndices.push(j);
      continue;
    }
    if (slotActive.get(acc.index)) activeAccountIndices.push(j);
  }

  return { activeAccountIndices, scannedAt: now };
}
