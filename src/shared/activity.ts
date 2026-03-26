import type { ActivityItem } from "./types";

/**
 * Address to offer for “save to address book” for native sends/receives or ERC-20 transfers.
 * Returns undefined for contract-heavy txs, failed txs, or when the peer cannot be determined.
 */
export function getActivityAddressBookCandidate(
  item: ActivityItem,
  userAddress: string,
): string | undefined {
  if (item.error) return undefined;
  const u = userAddress.toLowerCase();

  if (item.transfers.length > 0) {
    const withPeer = item.transfers.find((t) => t.peer);
    if (withPeer?.peer) return withPeer.peer;

    const transferEvent = item.events.find((e) => e.name === "Transfer");
    if (transferEvent) {
      const fromArg = transferEvent.args.find((a) => a.name === "from")?.value;
      const toArg = transferEvent.args.find((a) => a.name === "to")?.value;
      if (fromArg && toArg) {
        const from = fromArg.toLowerCase();
        const to = toArg.toLowerCase();
        if (from === u && to !== u) return toArg;
        if (to === u && from !== u) return fromArg;
      }
    }
    return undefined;
  }

  const value = BigInt(item.value || "0");
  if (value === 0n) return undefined;

  const hasCalldata = !!(item.method && item.method !== "0x");
  if (item.decoded || item.fn || hasCalldata) return undefined;

  if (!item.to) return undefined;

  const isSent = item.from.toLowerCase() === u;
  return isSent ? item.to : item.from;
}
