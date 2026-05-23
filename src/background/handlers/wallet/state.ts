/**
 * Whole-wallet state: GET_STATE, network switch, chain discovery, reset,
 * mnemonic / private-key export.
 */
import { type Address, zeroAddress } from "viem";
import { numberToHex } from "viem/utils";
import { formatProviderError } from "../../../shared/format";
import { IMPORTED_KEYRING_ID } from "../../../shared/keyring-constants";
import type { MessageResponse } from "../../../shared/messages";
import type { WalletState } from "../../../shared/types";
import { getActiveAccount, visibleAccounts } from "../../account-utils";
import { clearAllPending } from "../../approval";
import { broadcastEvent } from "../../broadcast";
import { runChainDiscovery } from "../../chain-discovery";
import { clearConnectedOrigins } from "../../connected-origins";
import { clearHdDerivedAddresses, resolveHdAddressMap } from "../../hd-addresses";
import * as keychain from "../../keychain";
import { bgLog } from "../../log";
import { getActiveNetworkId, setActiveNetworkId } from "../../networks";
import {
  clearVault,
  decryptVault,
  getStorageMode,
  isVaultInitialized,
  loadAccountsMeta,
  saveAccountsMeta,
} from "../../vault";
import * as wallet from "../../wallet";
import { retrieveHdMnemonicForKeyring } from "../../wallet-internal";
import { retrieveImportedKey } from "./_shared";

async function getWalletState(): Promise<WalletState> {
  const meta = await loadAccountsMeta();
  const mode = await getStorageMode();
  if (meta && meta.accounts.length > 0) {
    const visible = visibleAccounts(meta.accounts);
    const row = meta.accounts.find(
      (a) => a.address.toLowerCase() === meta.activeAccountAddress.toLowerCase(),
    );
    const activePointsToHiddenOrMissing = !row || row.hidden === true;
    const firstVis = visible[0];
    if (firstVis && activePointsToHiddenOrMissing) {
      // Repair drift: previous active account was soft-removed; fall through to first visible.
      const fixed = firstVis.address;
      await saveAccountsMeta(meta.accounts, fixed, meta.keyrings);
      broadcastEvent(
        "accountsChanged",
        visible.map((a) => a.address),
      );
      return {
        isInitialized: await isVaultInitialized(),
        storageMode: mode,
        accounts: visible,
        keyrings: meta.keyrings,
        activeAccountAddress: fixed,
        activeNetworkId: await getActiveNetworkId(),
      };
    }
  }
  return {
    isInitialized: await isVaultInitialized(),
    storageMode: mode,
    accounts: visibleAccounts(meta?.accounts ?? []),
    keyrings: meta?.keyrings ?? [],
    activeAccountAddress: meta?.activeAccountAddress ?? zeroAddress,
    activeNetworkId: await getActiveNetworkId(),
  };
}

export async function handleGetState(): Promise<MessageResponse> {
  return { ok: true, data: await getWalletState() };
}

export async function handleSwitchNetwork(chainId: number): Promise<MessageResponse> {
  await setActiveNetworkId(chainId);
  broadcastEvent("chainChanged", numberToHex(chainId));
  return { ok: true };
}

export async function handleEnsureChainDiscovery(chainId: number): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  if (!meta?.accounts.length) return { ok: false, error: "Wallet not initialized" };

  const visForDiscovery = visibleAccounts(meta.accounts);
  if (visForDiscovery.length > 0 && visForDiscovery.every((a) => a.path === "imported")) {
    return {
      ok: true,
      data: {
        activeAccountIndices: visForDiscovery.map((_, i) => i),
        scannedAt: Date.now(),
      },
    };
  }

  const hdMap = await resolveHdAddressMap();

  try {
    bgLog(`[chain-discovery] started with ${chainId}`);
    const data = await runChainDiscovery(chainId, meta, hdMap);
    return { ok: true, data };
  } catch (e) {
    const msg = formatProviderError(e);
    bgLog("[chain-discovery]", chainId, msg);
    return { ok: false, error: msg || "Chain scan failed" };
  }
}

export async function handleExportPrivateKey(
  address: Address,
  password?: string,
): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };
  const acc = meta.accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
  if (!acc || acc.hidden) return { ok: false, error: "Account not found" };
  if (acc.path === "imported") {
    const pk =
      (await retrieveImportedKey(mode, acc.address, password, "Export private key")) ?? null;
    if (!pk) return { ok: false, error: "Could not export key" };
    return { ok: true, data: { privateKey: pk } };
  }
  const mnemonic = await retrieveHdMnemonicForKeyring(
    mode,
    acc.keyringId,
    password,
    "Export private key",
  );
  const privateKey = wallet.getPrivateKeyForAccount(mnemonic, acc.index);
  return { ok: true, data: { privateKey } };
}

export async function handleExportMnemonic(
  keyringId: string | undefined,
  password?: string,
): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };
  const active = getActiveAccount(meta);
  const kid =
    keyringId ??
    (active?.path !== "imported"
      ? active?.keyringId
      : meta.keyrings.find((k) => k.type === "hd")?.id);
  if (!kid || kid === IMPORTED_KEYRING_ID) {
    return { ok: false, error: "No HD keyring to export" };
  }
  const mnemonic = await retrieveHdMnemonicForKeyring(
    mode,
    kid,
    password,
    "Export recovery phrase",
  );
  return { ok: true, data: { mnemonic } };
}

export async function handleResetWallet(password?: string): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "No wallet" };

  if (mode === "keychain") {
    const auth = await keychain.authenticateUser("Reset wallet");
    if (!auth.ok) {
      return {
        ok: false,
        error: auth.error ?? "Authentication failed or cancelled",
      };
    }
  } else {
    if (!password) return { ok: false, error: "Password required" };
    try {
      await decryptVault(password);
    } catch {
      return { ok: false, error: "Wrong password" };
    }
  }
  clearAllPending();
  for (const k of meta.keyrings) {
    if (k.type === "hd") await keychain.deleteMnemonicForKeyring(k.id);
  }
  await keychain.deleteAllImportedKeys(
    meta.accounts.filter((a) => a.path === "imported").map((a) => a.address),
  );
  await clearVault();
  await clearHdDerivedAddresses();
  await clearConnectedOrigins();
  broadcastEvent("accountsChanged", []);
  broadcastEvent("disconnect", { code: 4900, message: "Wallet reset" });
  return { ok: true };
}
