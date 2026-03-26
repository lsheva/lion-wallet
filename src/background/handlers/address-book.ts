import type { Address } from "viem";
import type { MessageResponse } from "../../shared/messages";
import {
  getAddressBook,
  getRecentAddresses,
  removeEntry,
  upsertEntry,
} from "../address-book";
import { loadAccountsMeta } from "../vault";

export async function handleGetAddressBook(): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  const sender = meta?.accounts[meta.activeAccountIndex]?.address;
  const [entries, recent] = await Promise.all([
    getAddressBook(),
    sender ? getRecentAddresses(sender) : Promise.resolve([]),
  ]);
  return { ok: true, data: { entries, recent } };
}

export async function handleUpsertAddressBookEntry(
  address: Address,
  name: string,
): Promise<MessageResponse> {
  await upsertEntry(address, name);
  return { ok: true };
}

export async function handleRemoveAddressBookEntry(address: Address): Promise<MessageResponse> {
  await removeEntry(address);
  return { ok: true };
}
