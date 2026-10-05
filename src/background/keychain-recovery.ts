/**
 * Keychain recovery.
 *
 * macOS stores the mnemonic(s) and imported private keys in the system Keychain
 * (service `app.lionwallet`), while only non-sensitive account metadata lives in
 * `browser.storage.local`. When that metadata is wiped — e.g. a macOS update
 * clears the extension's local storage — the wallet *appears* empty even though
 * the secrets are still in the Keychain.
 *
 * This module reconstructs the metadata from the Keychain in a single Touch ID
 * prompt: it authenticates once, dumps every stored item, then rebuilds
 * `accountsMeta` + the HD derivation map + `storageMode`.
 */
import { type Address, getAddress, type Hex, isAddress } from "viem";
import { IMPORTED_KEYRING_ID } from "../shared/keyring-constants";
import { mnemonicFingerprint } from "../shared/mnemonic-fingerprint";
import type { KeyringPublic, SerializedAccount } from "../shared/types";
import { broadcastEvent } from "./broadcast";
import { deriveHdAddressList, saveHdDerivedAddressMap } from "./hd-addresses";
import * as keychain from "./keychain";
import { bgLog } from "./log";
import { loadAccountsMeta, saveAccountsMeta, setStorageMode } from "./vault";
import * as wallet from "./wallet";

const KEYRING_PREFIX = "keyring-";
const IMPORTED_PREFIX = "imported-";

export interface KeychainRecoveryResult {
  recovered: boolean;
  hdKeyrings: number;
  importedAccounts: number;
}

/**
 * Attempt to rebuild wallet metadata from Keychain secrets when local storage
 * is empty. No-ops (and persists nothing) unless there are actually keys to
 * recover.
 */
export async function tryRecoverFromKeychain(): Promise<KeychainRecoveryResult> {
  try {
    if (await loadAccountsMeta()) {
      return { recovered: false, hdKeyrings: 0, importedAccounts: 0 };
    }

    const items = await keychain.recoverAllKeychainItems(
      "Recover your wallet from Keychain",
    );

    const hdMnemonics: { id: string; mnemonic: string }[] = [];
    const importedKeys: { address: Address; privateKey: Hex }[] = [];

    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith(KEYRING_PREFIX)) {
        const id = key.slice(KEYRING_PREFIX.length);
        if (id && value) hdMnemonics.push({ id, mnemonic: value });
      } else if (key.startsWith(IMPORTED_PREFIX)) {
        const raw = key.slice(IMPORTED_PREFIX.length);
        if (isAddress(raw) && value) {
          importedKeys.push({
            address: getAddress(raw),
            privateKey: value as Hex,
          });
        }
      }
    }

    if (hdMnemonics.length === 0 && importedKeys.length === 0) {
      return { recovered: false, hdKeyrings: 0, importedAccounts: 0 };
    }

    bgLog(
      `[keychain-recovery] found ${hdMnemonics.length} HD keyring(s), ${importedKeys.length} imported key(s)`,
    );

    const accounts: SerializedAccount[] = [];
    const keyringsPublic: KeyringPublic[] = [];
    const hdMap: Record<string, Address[]> = {};

    for (let i = 0; i < hdMnemonics.length; i++) {
      const entry = hdMnemonics[i];
      if (!entry) continue;
      const { id, mnemonic } = entry;
      accounts.push(wallet.deriveAccount(mnemonic, 0, id));
      keyringsPublic.push({
        id,
        label:
          hdMnemonics.length === 1
            ? "Main Wallet"
            : `Recovered wallet ${i + 1}`,
        type: "hd",
        mnemonicFingerprint: await mnemonicFingerprint(mnemonic),
      });
      hdMap[id] = deriveHdAddressList(mnemonic, id);
    }

    for (let i = 0; i < importedKeys.length; i++) {
      const entry = importedKeys[i];
      if (!entry) continue;
      const { address } = entry;
      accounts.push({
        name: `Imported Account ${i + 1}`,
        address,
        path: "imported",
        index: i,
        keyringId: IMPORTED_KEYRING_ID,
      });
    }

    if (importedKeys.length > 0) {
      keyringsPublic.push({
        id: IMPORTED_KEYRING_ID,
        label: "Imported",
        type: "imported",
      });
    }

    const active = accounts[0];
    if (!active) {
      return { recovered: false, hdKeyrings: 0, importedAccounts: 0 };
    }

    await setStorageMode("keychain");
    await saveAccountsMeta(accounts, active.address, keyringsPublic);
    if (Object.keys(hdMap).length > 0) {
      await saveHdDerivedAddressMap(hdMap);
    }
    broadcastEvent(
      "accountsChanged",
      accounts.map((a) => a.address),
    );

    bgLog(
      `[keychain-recovery] recovered ${accounts.length} account(s) from Keychain`,
    );
    return {
      recovered: true,
      hdKeyrings: hdMnemonics.length,
      importedAccounts: importedKeys.length,
    };
  } catch (e) {
    bgLog("[keychain-recovery] failed:", e);
    return { recovered: false, hdKeyrings: 0, importedAccounts: 0 };
  }
}
