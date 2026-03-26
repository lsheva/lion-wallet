import type { Address } from "viem";
import type { AddressBookEntry, RecentAddress } from "../shared/types";
import { StorageCache } from "./storage-cache";

const MAX_RECENT = 10;

const bookStore = new StorageCache<Record<string, unknown>>("addressBook", "addressBook");
const recentStore = new StorageCache<Record<string, RecentAddress[]>>(
  "recentAddresses",
  "recentAddresses",
);

export async function getAddressBook(): Promise<AddressBookEntry[]> {
  const data = await bookStore.load();
  return (data.entries as AddressBookEntry[] | undefined) ?? [];
}

export async function upsertEntry(address: Address, name: string): Promise<void> {
  const data = await bookStore.load();
  const entries: AddressBookEntry[] =
    (data.entries as AddressBookEntry[] | undefined) ?? [];
  const lower = address.toLowerCase();
  const idx = entries.findIndex((e) => e.address.toLowerCase() === lower);
  if (idx >= 0) {
    const existing = entries[idx]!;
    entries[idx] = { address: existing.address, name, addedAt: existing.addedAt };
  } else {
    entries.push({ address, name, addedAt: Date.now() });
  }
  data.entries = entries;
  await bookStore.persist();
}

export async function removeEntry(address: Address): Promise<void> {
  const data = await bookStore.load();
  const entries: AddressBookEntry[] =
    (data.entries as AddressBookEntry[] | undefined) ?? [];
  const lower = address.toLowerCase();
  data.entries = entries.filter((e) => e.address.toLowerCase() !== lower);
  await bookStore.persist();
}

export async function getRecentAddresses(sender: Address): Promise<RecentAddress[]> {
  const data = await recentStore.load();
  return data[sender.toLowerCase()] ?? [];
}

export async function pushRecentAddress(sender: Address, to: Address): Promise<void> {
  if (!to) return;
  const data = await recentStore.load();
  const key = sender.toLowerCase();
  const list: RecentAddress[] = data[key] ?? [];
  const lower = to.toLowerCase();
  const idx = list.findIndex((r) => r.address.toLowerCase() === lower);

  if (idx >= 0) {
    const existing = list[idx]!;
    list[idx] = { address: existing.address, lastUsedAt: Date.now(), useCount: existing.useCount + 1 };
  } else {
    list.push({ address: to, lastUsedAt: Date.now(), useCount: 1 });
  }

  list.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  data[key] = list.slice(0, MAX_RECENT);
  await recentStore.persist();
}
