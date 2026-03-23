import type { Address } from "viem";

import type { MessageResponse } from "../../shared/messages";
import { getEtherscanApiKey } from "../etherscan";
import * as keychain from "../keychain";
import { bgLog } from "../log";
import { setRpcProviderKeyInMemory } from "../networks";
import { getStorageMode } from "../vault";

export async function handleGetEtherscanKey(): Promise<MessageResponse> {
  const key = await getEtherscanApiKey();
  return { ok: true, data: { key } };
}

export async function handleSetEtherscanKey(key: string): Promise<MessageResponse> {
  if (key) {
    await browser.storage.local.set({ etherscanApiKey: key });
  } else {
    await browser.storage.local.remove("etherscanApiKey");
  }
  return { ok: true };
}

export async function handleGetRpcProviderKey(): Promise<MessageResponse> {
  const result = await browser.storage.local.get("rpcProviderKey");
  return { ok: true, data: { key: (result.rpcProviderKey as string) ?? null } };
}

export async function handleSetRpcProviderKey(key: string): Promise<MessageResponse> {
  if (key) {
    await browser.storage.local.set({ rpcProviderKey: key });
    setRpcProviderKeyInMemory(key);
  } else {
    await browser.storage.local.remove("rpcProviderKey");
    setRpcProviderKeyInMemory(null);
  }
  return { ok: true };
}

export async function handleGetStorageMode(): Promise<MessageResponse> {
  const mode = await getStorageMode();
  return { ok: true, data: { storageMode: mode } };
}

export async function handleCheckKeychainAvailable(): Promise<MessageResponse> {
  const probe = await keychain.isKeychainAvailable();
  bgLog("[CHECK_KEYCHAIN_AVAILABLE] probe:", JSON.stringify(probe));
  return { ok: true, data: { available: probe.available, error: probe.error } };
}

export async function handleGetActivity(
  address: Address,
  chainId: number,
  loadMore: boolean,
): Promise<MessageResponse> {
  const { fetchActivity } = await import("../activity");
  const result = await fetchActivity(address, chainId, { loadMore });
  return { ok: true, data: result };
}

export async function handleClearActivityCache(): Promise<MessageResponse> {
  const { clearActivityCache } = await import("../activity");
  const { clearAbiCache } = await import("../etherscan");
  const { clearTokenStore } = await import("../token-store");
  const { clearTokenImageCache } = await import("../token-images");
  await Promise.all([clearActivityCache(), clearAbiCache(), clearTokenStore(), clearTokenImageCache()]);
  return { ok: true };
}
