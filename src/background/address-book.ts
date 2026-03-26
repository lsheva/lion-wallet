import { type Address, getAddress } from "viem";
import type { AddressBookEntry, RecentAddress } from "../shared/types";
import { StorageCache } from "./storage-cache";

const MAX_RECENT = 3;

const bookStore = new StorageCache<Record<string, unknown>>("addressBook", "addressBook");
const recentStore = new StorageCache<Record<string, RecentAddress[]>>(
  "recentAddresses",
  "recentAddresses",
);

export async function getAddressBook(): Promise<AddressBookEntry[]> {
  const data = await bookStore.load();
  const entries = (data.entries as AddressBookEntry[] | undefined) ?? [];
  let dirty = false;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const checksummed = getAddress(entry.address);
    if (checksummed !== entry.address) {
      entries[i] = { ...entry, address: checksummed };
      dirty = true;
    }
  }
  if (dirty) {
    data.entries = entries;
    await bookStore.persist();
  }
  return entries;
}

export async function upsertEntry(address: Address, name: string): Promise<void> {
  const checksummed = getAddress(address);
  const data = await bookStore.load();
  const entries: AddressBookEntry[] = (data.entries as AddressBookEntry[] | undefined) ?? [];
  const lower = checksummed.toLowerCase();
  const idx = entries.findIndex((e) => e.address.toLowerCase() === lower);
  if (idx >= 0) {
    const existing = entries[idx]!;
    entries[idx] = { address: checksummed, name, addedAt: existing.addedAt };
  } else {
    entries.push({ address: checksummed, name, addedAt: Date.now() });
  }
  data.entries = entries;
  await bookStore.persist();
}

export async function removeEntry(address: Address): Promise<void> {
  const data = await bookStore.load();
  const entries: AddressBookEntry[] = (data.entries as AddressBookEntry[] | undefined) ?? [];
  const lower = address.toLowerCase();
  data.entries = entries.filter((e) => e.address.toLowerCase() !== lower);
  await bookStore.persist();
}

export async function getRecentAddresses(sender: Address): Promise<RecentAddress[]> {
  const data = await recentStore.load();
  const key = sender.toLowerCase();
  const list = data[key] ?? [];
  let dirty = false;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    if (!entry) continue;
    const checksummed = getAddress(entry.address);
    if (checksummed !== entry.address) {
      list[i] = { ...entry, address: checksummed };
      dirty = true;
    }
  }
  if (dirty) {
    data[key] = list;
    await recentStore.persist();
  }
  return list;
}

export async function pushRecentAddress(sender: Address, to: Address): Promise<void> {
  if (!to) return;
  const checksummedTo = getAddress(to);
  const data = await recentStore.load();
  const key = sender.toLowerCase();
  const list: RecentAddress[] = data[key] ?? [];
  const lower = checksummedTo.toLowerCase();
  const idx = list.findIndex((r) => r.address.toLowerCase() === lower);

  if (idx >= 0) {
    const existing = list[idx]!;
    list[idx] = { address: checksummedTo, lastUsedAt: Date.now(), useCount: existing.useCount + 1 };
  } else {
    list.push({ address: checksummedTo, lastUsedAt: Date.now(), useCount: 1 });
  }

  list.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  data[key] = list.slice(0, MAX_RECENT);
  await recentStore.persist();
}
