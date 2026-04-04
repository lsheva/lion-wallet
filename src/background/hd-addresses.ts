import type { Address } from "viem";
import { HD_DERIVATION_DEFAULT_CEILING } from "../shared/hd-constants";
import type { SerializedAccount } from "../shared/types";
import type { AccountsMeta } from "./vault";
import * as wallet from "./wallet";

const HD_DERIVED_ADDRESSES_KEY = "hdDerivedAddresses";

/** Public derived addresses for slots `0 .. CEILING-1` (scanning RPC without unlocking mnemonic each time). */
export async function loadHdDerivedAddresses(): Promise<Address[] | null> {
  const r = await browser.storage.local.get(HD_DERIVED_ADDRESSES_KEY);
  const v = r[HD_DERIVED_ADDRESSES_KEY] as Address[] | undefined;
  return v && v.length === HD_DERIVATION_DEFAULT_CEILING ? v : null;
}

export async function saveHdDerivedAddresses(addresses: Address[]): Promise<void> {
  await browser.storage.local.set({ [HD_DERIVED_ADDRESSES_KEY]: addresses });
}

export async function clearHdDerivedAddresses(): Promise<void> {
  await browser.storage.local.remove(HD_DERIVED_ADDRESSES_KEY);
}

export function deriveHdAddressList(mnemonic: string): Address[] {
  return Array.from({ length: HD_DERIVATION_DEFAULT_CEILING }, (_, i) =>
    wallet.deriveAccount(mnemonic, i).address,
  );
}

/** Rebuild the 20-address list from a legacy wallet that already stored 20 HD accounts. */
export function tryMigrateHdAddressesFromMeta(meta: AccountsMeta): Address[] | null {
  const hd = meta.accounts.filter((a) => a.path !== "imported").sort((a, b) => a.index - b.index);
  if (hd.length < HD_DERIVATION_DEFAULT_CEILING) return null;
  for (let i = 0; i < HD_DERIVATION_DEFAULT_CEILING; i++) {
    if (hd[i]?.index !== i) return null;
  }
  return hd.slice(0, HD_DERIVATION_DEFAULT_CEILING).map((a) => a.address);
}

export function serializedAccountForSlot(i: number, address: Address): SerializedAccount {
  return {
    name: `Account ${i + 1}`,
    address,
    path: `m/44'/60'/0'/0/${i}`,
    index: i,
  };
}

/** Load stored 20-slot addresses, migrate from legacy 20-account wallets, or return null. */
export async function resolveHdAddressList(meta: AccountsMeta): Promise<Address[] | null> {
  const existing = await loadHdDerivedAddresses();
  if (existing) return existing;

  const migrated = tryMigrateHdAddressesFromMeta(meta);
  if (migrated) {
    await saveHdDerivedAddresses(migrated);
    return migrated;
  }

  return null;
}
