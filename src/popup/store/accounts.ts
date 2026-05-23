/**
 * Account signals: keyrings, wallet accounts, the active account address,
 * storage mode, and per-chain "which derivations have activity" state.
 *
 * Async actions that touch the background (rename, switch, derive, import,
 * delete...) live below as members of `accountActions`. Network or balance
 * side effects after these actions are orchestrated in [`./index.ts`](./index.ts).
 */

import { toErrorMessage } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { KeyringPublic, SerializedAccount } from "@shared/types";
import { createMemo, createRoot, createSignal } from "solid-js";
import { type Address, type Hex, zeroAddress } from "viem";
import { showError } from "../toast";
import { setActiveNetworkId } from "./network";

export const [accounts, setAccounts] = createSignal<SerializedAccount[]>([]);
export const [activeAccountAddress, setActiveAccountAddress] = createSignal<Address>(zeroAddress);
export const [keyrings, setKeyrings] = createSignal<KeyringPublic[]>([]);
export const [storageMode, setStorageMode] = createSignal<"keychain" | "vault">("vault");

/** Per-chain home list: `null` before first discovery result for this session. */
export const [homeDiscoveryActiveIndices, setHomeDiscoveryActiveIndices] = createSignal<
  number[] | null
>(null);
export const [chainDiscoveryScanning, setChainDiscoveryScanning] = createSignal(false);

const derived = createRoot(() => {
  const activeAccountIndex = createMemo(() => {
    const addr = activeAccountAddress();
    return accounts().findIndex((a) => a.address.toLowerCase() === addr.toLowerCase());
  });

  const activeAccount = createMemo(() => {
    const list = accounts();
    const addr = activeAccountAddress();
    const found = list.find((a) => a.address.toLowerCase() === addr.toLowerCase());
    return (
      found ?? {
        name: "Account 1",
        address: zeroAddress,
        path: "m/44'/60'/0'/0/0",
        index: 0,
        keyringId: "default",
      }
    );
  });

  return { activeAccount, activeAccountIndex };
});

export const { activeAccount, activeAccountIndex } = derived;

/** Accounts visible on Home / AccountSwitcher for the current chain (lazy discovery). */
export function homeAccountsForSwitcher(): {
  account: SerializedAccount;
  accountArrayIndex: number;
}[] {
  const all = accounts();
  const idxSet = homeDiscoveryActiveIndices();
  const scanning = chainDiscoveryScanning();

  if (scanning && idxSet === null) {
    const first = all[0];
    if (!first) return [];
    return [{ account: first, accountArrayIndex: 0 }];
  }
  if (idxSet == null) {
    return all.map((account, accountArrayIndex) => ({ account, accountArrayIndex }));
  }
  const out: { account: SerializedAccount; accountArrayIndex: number }[] = [];
  for (const i of idxSet) {
    const account = all[i];
    if (account) out.push({ account, accountArrayIndex: i });
  }
  return out;
}

/**
 * Fetch the latest derivation list and balances for the current chain.
 * Used during onboarding, "Re-scan" in Settings, and when switching chains.
 */
export async function ensureChainDiscoveryForChain(chainId: number): Promise<void> {
  const list = accounts();
  if (list.length === 0) return;
  if (list.length === 1 && list[0]?.path === "imported") {
    setHomeDiscoveryActiveIndices([0]);
    return;
  }

  setChainDiscoveryScanning(true);
  try {
    const res = await sendMessage({
      type: "ENSURE_CHAIN_DISCOVERY",
      chainId,
    });
    if (res.ok && res.data) {
      setHomeDiscoveryActiveIndices(res.data.activeAccountIndices);
      await fetchState();
    } else if (!res.ok) {
      showError(
        "Chain scan failed",
        res.error?.trim() || "RPC error — try again or use another network",
      );
    }
  } catch (e) {
    showError("Chain scan failed", toErrorMessage(e));
  } finally {
    setChainDiscoveryScanning(false);
  }
}

/** Pull GET_STATE from the background and apply into the signals. */
export async function fetchState(): Promise<void> {
  const res = await sendMessage({ type: "GET_STATE" });
  if (!res.ok || !res.data) return;
  // Solid `batch()` would be ideal but importing it here would create a cycle.
  setAccounts(res.data.accounts);
  setKeyrings(res.data.keyrings);
  setActiveAccountAddress(res.data.activeAccountAddress);
  setActiveNetworkId(res.data.activeNetworkId);
  setStorageMode(res.data.storageMode);
}

// ── Mutations (no chain-side fetches; orchestrators in ./index.ts call these) ──

export async function renameAccount(index: number, newName: string): Promise<void> {
  const acc = accounts()[index];
  if (!acc) return;
  const res = await sendMessage({
    type: "RENAME_ACCOUNT",
    address: acc.address,
    name: newName.trim() || acc.name,
  });
  if (res.ok) {
    await fetchState();
  } else {
    setAccounts(
      accounts().map((a, i) => (i === index ? { ...a, name: newName.trim() || a.name } : a)),
    );
  }
}

export async function addAccount(password?: string): Promise<void> {
  const res = await sendMessage({
    type: "ADD_ACCOUNT",
    ...(password ? { password } : {}),
  });
  if (res.ok) {
    await fetchState();
  } else {
    showError("Failed to add account", res.error);
  }
}

export async function deriveInKeyring(keyringId: string, password?: string): Promise<boolean> {
  const res = await sendMessage({
    type: "DERIVE_ACCOUNT",
    keyringId,
    ...(password ? { password } : {}),
  });
  if (!res.ok) {
    showError("Could not add account", res.error);
    return false;
  }
  await fetchState();
  return true;
}

export async function importPrivateKey(privateKey: Hex, password?: string): Promise<boolean> {
  const res = await sendMessage({
    type: "IMPORT_PRIVATE_KEY",
    privateKey,
    ...(password ? { password } : {}),
  });
  if (!res.ok) {
    showError("Could not add private key", res.error);
    return false;
  }
  await fetchState();
  return true;
}

export async function addKeyringCreate(password?: string): Promise<{ mnemonic: string } | null> {
  const res = await sendMessage({
    type: "ADD_KEYRING_CREATE",
    ...(password ? { password } : {}),
  });
  if (res.ok && res.data?.mnemonic) {
    await fetchState();
    return { mnemonic: res.data.mnemonic };
  }
  if (!res.ok) {
    showError("Could not create keyring", res.error);
  }
  return null;
}

export async function addKeyringImport(mnemonic: string, password?: string): Promise<boolean> {
  const res = await sendMessage({
    type: "ADD_KEYRING_IMPORT",
    mnemonic: mnemonic.trim(),
    ...(password ? { password } : {}),
  });
  if (!res.ok) {
    showError("Could not import keyring", res.error);
    return false;
  }
  await fetchState();
  return true;
}

export async function renameKeyring(keyringId: string, label: string): Promise<boolean> {
  const res = await sendMessage({
    type: "RENAME_KEYRING",
    keyringId,
    label: label.trim(),
  });
  if (!res.ok) {
    showError("Could not rename wallet", res.error);
    return false;
  }
  await fetchState();
  return true;
}

export async function deleteKeyring(keyringId: string, password?: string): Promise<boolean> {
  const res = await sendMessage({
    type: "DELETE_KEYRING",
    keyringId,
    ...(password ? { password } : {}),
  });
  if (!res.ok) {
    showError("Could not delete wallet", res.error);
    return false;
  }
  await fetchState();
  return true;
}

export async function removeAccount(accountIndex: number, password?: string): Promise<boolean> {
  const acc = accounts()[accountIndex];
  if (!acc) return false;
  const res = await sendMessage({
    type: "REMOVE_ACCOUNT",
    address: acc.address,
    ...(password ? { password } : {}),
  });
  if (!res.ok) {
    showError("Could not remove account", res.error);
    return false;
  }
  await fetchState();
  return true;
}
