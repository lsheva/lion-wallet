/**
 * Pure helpers and shared types for the Send / Multi-send page.
 *
 * The page is structured as N "token groups", each with M recipients. Single
 * send is just `N=1, M=1`; multi-send is everything else. The `groups`
 * signal state machine in [`../Send.tsx`](../Send.tsx) is the source of
 * truth.
 */
import type { Token } from "../../store";

export interface Recipient {
  id: number;
  to: string;
  amount: string;
}

export interface TokenGroup {
  id: number;
  token: Token;
  /** Mirror recipients from group #0; only meaningful for non-first groups. */
  useSameRecipients: boolean;
  /** When true, every recipient gets `singleAmount`; otherwise per-recipient `amount`. */
  uniformAmount: boolean;
  singleAmount: string;
  recipients: Recipient[];
}

let nextRId = 0;
let nextGId = 0;

export const emptyR = (): Recipient => ({ id: nextRId++, to: "", amount: "" });

export const mkGroup = (token: Token, useSameRecipients = false): TokenGroup => ({
  id: nextGId++,
  token,
  useSameRecipients,
  uniformAmount: true,
  singleAmount: "",
  recipients: [emptyR()],
});

export const isNative = (token: Token): boolean => !token.address;

/**
 * Resolve the recipients to display for the group at `gi`. For non-first
 * groups with `useSameRecipients=true`, the addresses come from group 0 but
 * amounts are local to this group (so per-token amounts can differ).
 */
export function displayRecs(groups: TokenGroup[], gi: number): Recipient[] {
  const grp = groups[gi];
  if (grp === undefined) return [];
  if (!grp.useSameRecipients || gi === 0) return grp.recipients;
  const first = groups[0];
  if (!first) return grp.recipients;
  return first.recipients.map((r, i) => ({
    id: r.id,
    to: r.to,
    amount: grp.recipients[i]?.amount ?? "",
  }));
}

export function getAmount(grp: TokenGroup, rec: Recipient): string {
  return grp.uniformAmount ? grp.singleAmount : rec.amount;
}

/** Friendly relative time used by the "recent recipients" dropdown. */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
