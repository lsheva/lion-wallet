import type { Address } from "viem";
import { HD_DERIVATION_DEFAULT_CEILING } from "../shared/hd-constants";
import type { SerializedAccount } from "../shared/types";
import * as wallet from "./wallet";

const HD_DERIVED_ADDRESSES_KEY = "hdDerivedAddresses";
const HD_DERIVED_BY_KEYRING_KEY = "hdDerivedAddressesByKeyring";

export type HdDerivedAddressMap = Record<string, Address[]>;

/** Public derived addresses per keyring for slots `0 .. CEILING-1`. */
export async function loadHdDerivedAddressMap(): Promise<HdDerivedAddressMap | null> {
  const r = await browser.storage.local.get(HD_DERIVED_BY_KEYRING_KEY);
  const v = r[HD_DERIVED_BY_KEYRING_KEY] as HdDerivedAddressMap | undefined;
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 0) return null;
    const allValid = keys.every(
      (k) => v[k]?.length === HD_DERIVATION_DEFAULT_CEILING,
    );
    if (allValid) return v;
  }
  return null;
}

export async function saveHdDerivedAddressMap(map: HdDerivedAddressMap): Promise<void> {
  await browser.storage.local.set({ [HD_DERIVED_BY_KEYRING_KEY]: map });
}

export async function clearHdDerivedAddresses(): Promise<void> {
  await browser.storage.local.remove([HD_DERIVED_ADDRESSES_KEY, HD_DERIVED_BY_KEYRING_KEY]);
}

export function deriveHdAddressList(mnemonic: string, keyringId: string): Address[] {
  return Array.from({ length: HD_DERIVATION_DEFAULT_CEILING }, (_, i) =>
    wallet.deriveAccount(mnemonic, i, keyringId).address,
  );
}

export function serializedAccountForSlot(
  i: number,
  address: Address,
  keyringId: string,
): SerializedAccount {
  return {
    name: `Account ${i + 1}`,
    address,
    path: `m/44'/60'/0'/0/${i}`,
    index: i,
    keyringId,
  };
}

/** Stored per-keyring HD lists, or null until first import/derive. */
export async function resolveHdAddressMap(): Promise<HdDerivedAddressMap | null> {
  return loadHdDerivedAddressMap();
}
