import { toErrorMessage } from "@shared/format";
import type { Address, Hex } from "viem";

import { keychainKeyringKey } from "../shared/keyring-constants";
import { bgLog } from "./log";

const APP_ID = "app.lionwallet";

interface NativeResponse {
  ok: boolean;
  value?: string;
  exists?: boolean;
  error?: string;
}

async function sendNative(message: Record<string, unknown>): Promise<NativeResponse> {
  bgLog("[keychain] sendNative:", message.action);
  const res = (await browser.runtime.sendNativeMessage(APP_ID, message)) as NativeResponse;
  bgLog("[keychain] response:", JSON.stringify(res));
  return res;
}

export interface ProbeResult {
  available: boolean;
  error?: string;
}

export async function isKeychainAvailable(): Promise<ProbeResult> {
  try {
    const res = await sendNative({ action: "keychain_status" });
    return { available: res.ok === true, error: res.error };
  } catch (e) {
    const msg = toErrorMessage(e);
    bgLog("[keychain] isKeychainAvailable exception:", msg);
    return { available: false, error: `exception: ${msg}` };
  }
}

export interface StoreResult {
  ok: boolean;
  error?: string;
}

export async function storeMnemonicForKeyring(
  keyringId: string,
  mnemonic: string,
): Promise<StoreResult> {
  try {
    const res = await sendNative({
      action: "keychain_store",
      key: keychainKeyringKey(keyringId),
      value: mnemonic,
    });
    if (!res.ok) {
      bgLog("[keychain] storeMnemonicForKeyring failed:", res.error);
      return { ok: false, error: res.error ?? "store returned ok=false" };
    }
    return { ok: true };
  } catch (e) {
    const msg = toErrorMessage(e);
    bgLog("[keychain] storeMnemonicForKeyring exception:", msg);
    return { ok: false, error: `exception: ${msg}` };
  }
}

/** Face ID / Touch ID only — does not read keychain (use for reset, etc.). */
export async function authenticateUser(reason?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await sendNative({
      action: "keychain_authenticate",
      ...(reason && { reason }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: res.error ?? "Authentication failed" };
  } catch (e) {
    const msg = toErrorMessage(e);
    bgLog("[keychain] authenticateUser exception:", msg);
    return { ok: false, error: msg };
  }
}

export async function retrieveMnemonicForKeyring(
  keyringId: string,
  reason?: string,
): Promise<string | null> {
  try {
    const res = await sendNative({
      action: "keychain_retrieve",
      key: keychainKeyringKey(keyringId),
      ...(reason && { reason }),
    });
    return res.ok ? (res.value ?? null) : null;
  } catch (e) {
    bgLog("[keychain] retrieveMnemonicForKeyring exception:", toErrorMessage(e));
    return null;
  }
}

export async function deleteMnemonicForKeyring(keyringId: string): Promise<void> {
  try {
    await sendNative({ action: "keychain_delete", key: keychainKeyringKey(keyringId) });
  } catch (e) {
    bgLog("[keychain] deleteMnemonicForKeyring exception:", toErrorMessage(e));
  }
}

export async function hasMnemonicForKeyring(keyringId: string): Promise<boolean> {
  try {
    const res = await sendNative({ action: "keychain_has", key: keychainKeyringKey(keyringId) });
    return res.ok === true && res.exists === true;
  } catch (e) {
    bgLog("[keychain] hasMnemonicForKeyring exception:", toErrorMessage(e));
    return false;
  }
}

function importedKeyId(address: Address): string {
  return `imported-${address.toLowerCase()}`;
}

export async function storeImportedKey(address: Address, privateKey: Hex): Promise<StoreResult> {
  try {
    const res = await sendNative({
      action: "keychain_store",
      key: importedKeyId(address),
      value: privateKey,
    });
    if (!res.ok) {
      bgLog("[keychain] storeImportedKey failed:", res.error);
      return { ok: false, error: res.error ?? "store returned ok=false" };
    }
    return { ok: true };
  } catch (e) {
    const msg = toErrorMessage(e);
    bgLog("[keychain] storeImportedKey exception:", msg);
    return { ok: false, error: `exception: ${msg}` };
  }
}

export async function retrieveImportedKey(address: Address, reason?: string): Promise<Hex | null> {
  try {
    const res = await sendNative({
      action: "keychain_retrieve",
      key: importedKeyId(address),
      ...(reason && { reason }),
    });
    return res.ok ? ((res.value as Hex) ?? null) : null;
  } catch (e) {
    bgLog("[keychain] retrieveImportedKey exception:", toErrorMessage(e));
    return null;
  }
}

export async function deleteImportedKey(address: Address): Promise<void> {
  try {
    await sendNative({
      action: "keychain_delete",
      key: importedKeyId(address),
    });
  } catch (e) {
    bgLog("[keychain] deleteImportedKey exception:", toErrorMessage(e));
  }
}

export async function deleteAllImportedKeys(addresses: Address[]): Promise<void> {
  await Promise.all(addresses.map(deleteImportedKey));
}
