import type { Address } from "viem";

import type { VaultData } from "./types";

export function normalizeMnemonicForCompare(mnemonic: string): string {
  return mnemonic
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join(" ");
}

/** Decrypted vault JSON must be v2 (multi-keyring) shape. */
export function normalizeVaultData(parsed: unknown): VaultData {
  const o = parsed as VaultData & { keyrings?: unknown };
  if (!o.keyrings || !Array.isArray(o.keyrings) || o.keyrings.length === 0) {
    throw new Error("Invalid vault: expected keyrings array");
  }
  const accounts = o.accounts ?? [];
  const addr = o.activeAccountAddress ?? accounts[0]?.address;
  if (!addr) throw new Error("Invalid vault: no accounts");
  return {
    keyrings: o.keyrings,
    accounts,
    activeAccountAddress: addr as Address,
    ...(o.importedKeys ? { importedKeys: o.importedKeys } : {}),
  };
}
