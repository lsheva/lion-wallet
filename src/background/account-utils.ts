import type { Address } from "viem";

import type { SerializedAccount } from "../shared/types";
import type { AccountsMeta } from "./vault";

/** Accounts shown in UI and exposed to dApps (`hidden` is HD tombstones only). */
export function visibleAccounts(accounts: SerializedAccount[]): SerializedAccount[] {
  return accounts.filter((a) => !a.hidden);
}

/**
 * The row for `activeAccountAddress`, or the first visible account if that address is missing
 * or is an HD tombstone (`hidden`). The latter avoids undefined after soft-remove if meta drifts.
 */
export function getActiveAccount(meta: AccountsMeta): SerializedAccount | undefined {
  const visible = visibleAccounts(meta.accounts);
  if (visible.length === 0) return undefined;
  const lower = meta.activeAccountAddress.toLowerCase();
  const row = meta.accounts.find((a) => a.address.toLowerCase() === lower);
  if (row && !row.hidden) return row;
  return visible[0];
}

export function findAccountIndexByAddress(accounts: SerializedAccount[], address: Address): number {
  const lower = address.toLowerCase();
  return accounts.findIndex((a) => a.address.toLowerCase() === lower);
}
