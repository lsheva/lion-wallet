import browser from "webextension-polyfill";
import type { Hex, Address } from "viem";
import { bgLog } from "./log";

const APP_ID = "dev.wallet.SafariEVMWallet";

interface NativeResponse {
  ok: boolean;
  value?: string;
  exists?: boolean;
  error?: string;
}

async function sendNative(
  message: Record<string, unknown>,
): Promise<NativeResponse> {
  bgLog("[keychain] sendNative:", message.action);
  const res = (await browser.runtime.sendNativeMessage(
    APP_ID,
    message,
  )) as NativeResponse;
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
    if (!res.ok) {
      bgLog("[keychain] probe failed:", res.error ?? "unknown");
    }
    return { available: res.ok === true, error: res.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    bgLog("[keychain] isKeychainAvailable exception:", msg);
    return { available: false, error: `exception: ${msg}` };
  }
}

export interface StoreResult {
  ok: boolean;
  error?: string;
}

export async function storeMnemonic(mnemonic: string): Promise<StoreResult> {
  try {
    const res = await sendNative({
      action: "keychain_store",
      key: "mnemonic",
      value: mnemonic,
    });
    if (!res.ok) {
      bgLog("[keychain] storeMnemonic failed:", res.error);
      return { ok: false, error: res.error ?? "store returned ok=false" };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    bgLog("[keychain] storeMnemonic exception:", msg);
    return { ok: false, error: `exception: ${msg}` };
  }
}

export async function retrieveMnemonic(): Promise<string | null> {
  try {
    const res = await sendNative({
      action: "keychain_retrieve",
      key: "mnemonic",
    });
    return res.ok ? (res.value ?? null) : null;
  } catch {
    return null;
  }
}

export async function deleteMnemonic(): Promise<void> {
  try {
    await sendNative({ action: "keychain_delete", key: "mnemonic" });
  } catch {
    /* unavailable */
  }
}

export async function hasMnemonic(): Promise<boolean> {
  try {
    const res = await sendNative({ action: "keychain_has", key: "mnemonic" });
    return res.ok === true && res.exists === true;
  } catch {
    return false;
  }
}

function importedKeyId(address: Address): string {
  return `imported-${address.toLowerCase()}`;
}

export async function storeImportedKey(
  address: Address,
  privateKey: Hex,
): Promise<StoreResult> {
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
    const msg = e instanceof Error ? e.message : String(e);
    bgLog("[keychain] storeImportedKey exception:", msg);
    return { ok: false, error: `exception: ${msg}` };
  }
}

export async function retrieveImportedKey(
  address: Address,
): Promise<Hex | null> {
  try {
    const res = await sendNative({
      action: "keychain_retrieve",
      key: importedKeyId(address),
    });
    return res.ok ? ((res.value as Hex) ?? null) : null;
  } catch {
    return null;
  }
}

export async function deleteImportedKey(address: Address): Promise<void> {
  try {
    await sendNative({
      action: "keychain_delete",
      key: importedKeyId(address),
    });
  } catch {
    /* unavailable */
  }
}

export async function deleteAllImportedKeys(
  addresses: Address[],
): Promise<void> {
  await Promise.all(addresses.map(deleteImportedKey));
}
