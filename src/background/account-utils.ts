import type { Address } from "viem";

import type { SerializedAccount } from "../shared/types";
import type { AccountsMeta } from "./vault";

export function getActiveAccount(meta: AccountsMeta): SerializedAccount | undefined {
  const lower = meta.activeAccountAddress.toLowerCase();
  return meta.accounts.find((a) => a.address.toLowerCase() === lower);
}

export function findAccountIndexByAddress(accounts: SerializedAccount[], address: Address): number {
  const lower = address.toLowerCase();
  return accounts.findIndex((a) => a.address.toLowerCase() === lower);
}
