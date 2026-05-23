/**
 * Wallets-and-Accounts section of Settings.
 *
 * Owns the keyring/account list (HD keyrings expandable, imported keyring at
 * the bottom) and every modal opened from it: per-account info (rename,
 * export private key, remove), per-wallet info (rename, reveal mnemonic,
 * delete), confirm-delete-keyring, confirm-remove-account, derive-account
 * (vault-mode password prompt inline), import-private-key, and add-mnemonic.
 *
 * State is intentionally co-located rather than split into per-modal files
 * because the action handlers chain (open info -> reveal -> confirm) and
 * splitting them would force a lot of prop drilling for marginal gains.
 */

import { truncateAddress, truncateAddressPreview } from "@shared/format";
import { IMPORTED_KEYRING_ID } from "@shared/keyring-constants";
import { sendMessage } from "@shared/messages";
import type { KeyringPublic } from "@shared/types";
import { ChevronRight, Eye, EyeOff, Fingerprint, Info, Key, Plus } from "lucide-solid";
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { type Address, zeroAddress } from "viem";
import {
  english,
  generateMnemonic,
  generatePrivateKey,
  mnemonicToAccount,
  privateKeyToAccount,
} from "viem/accounts";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CopyButton } from "../../components/CopyButton";
import { Identicon } from "../../components/Identicon";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { keyringDotClass } from "../../keyring-ui";
import { walletState } from "../../store";
import { showError } from "../../toast";
import { AccountRow } from "./AccountRow";

export function WalletAndAccounts() {
  const [expandedKeyringIds, setExpandedKeyringIds] = createSignal<Set<string>>(new Set());
  const isKeyringExpanded = (id: string) => expandedKeyringIds().has(id);
  const toggleKeyringExpanded = (id: string) => {
    setExpandedKeyringIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [accountInfoIndex, setAccountInfoIndex] = createSignal<number | null>(null);
  const [accountInfoName, setAccountInfoName] = createSignal("");
  const [pkExportPassword, setPkExportPassword] = createSignal("");
  const [pkExportRevealed, setPkExportRevealed] = createSignal(false);
  const [pkExportKey, setPkExportKey] = createSignal("");
  const [pkExportLoading, setPkExportLoading] = createSignal(false);
  const [pkExportError, setPkExportError] = createSignal("");
  const [pkShowKey, setPkShowKey] = createSignal(false);

  const [walletInfoKeyringId, setWalletInfoKeyringId] = createSignal<string | null>(null);
  const [walletInfoLabel, setWalletInfoLabel] = createSignal("");
  const [walletInfoBusy, setWalletInfoBusy] = createSignal(false);
  const [walletInfoError, setWalletInfoError] = createSignal("");
  const [mnExportPassword, setMnExportPassword] = createSignal("");
  const [mnExportRevealed, setMnExportRevealed] = createSignal(false);
  const [mnExportWords, setMnExportWords] = createSignal<string[]>([]);
  const [mnExportLoading, setMnExportLoading] = createSignal(false);
  const [mnExportError, setMnExportError] = createSignal("");
  const [mnBlurred, setMnBlurred] = createSignal(true);

  const [deleteKrId, setDeleteKrId] = createSignal<string | null>(null);
  const [deleteKrPw, setDeleteKrPw] = createSignal("");
  const [deleteKrBusy, setDeleteKrBusy] = createSignal(false);
  const [deleteKrError, setDeleteKrError] = createSignal("");

  const [removeAccIdx, setRemoveAccIdx] = createSignal<number | null>(null);
  const [removeAccPw, setRemoveAccPw] = createSignal("");
  const [removeAccBusy, setRemoveAccBusy] = createSignal(false);
  const [removeAccError, setRemoveAccError] = createSignal("");

  const [deriveForKeyringId, setDeriveForKeyringId] = createSignal<string | null>(null);
  const [derivePassword, setDerivePassword] = createSignal("");
  const [deriveError, setDeriveError] = createSignal("");
  const [showImportPkModal, setShowImportPkModal] = createSignal(false);
  const [importPkValue, setImportPkValue] = createSignal("");
  const [importPkVaultPw, setImportPkVaultPw] = createSignal("");
  const [importPkBusy, setImportPkBusy] = createSignal(false);
  const [importPkError, setImportPkError] = createSignal("");
  const [showAddMnemonicModal, setShowAddMnemonicModal] = createSignal(false);
  const [addMnemonicPhrase, setAddMnemonicPhrase] = createSignal("");
  const [addMnemonicShowPhrase, setAddMnemonicShowPhrase] = createSignal(false);
  const [addMnemonicVaultPw, setAddMnemonicVaultPw] = createSignal("");
  const [addMnemonicBusy, setAddMnemonicBusy] = createSignal(false);
  const [addMnemonicError, setAddMnemonicError] = createSignal("");

  const importPkPreviewAddress = createMemo((): Address | null => {
    const pk = importPkValue().trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) return null;
    try {
      return privateKeyToAccount(pk as `0x${string}`).address;
    } catch {
      return null;
    }
  });

  const addMnemonicPreviewAddress = createMemo((): Address | null => {
    const phrase = addMnemonicPhrase().trim();
    if (!phrase) return null;
    const words = phrase.split(/\s+/).filter(Boolean);
    if (words.length !== 12 && words.length !== 24) return null;
    try {
      return mnemonicToAccount(phrase).address;
    } catch {
      return null;
    }
  });

  const [pendingKeyringDelete, setPendingKeyringDelete] = createSignal<{
    id: string;
    label: string;
  } | null>(null);
  const [pendingAccountRemoveIdx, setPendingAccountRemoveIdx] = createSignal<number | null>(null);

  const accountRows = createMemo(() =>
    walletState.accounts().map((account, accountArrayIndex) => ({ account, accountArrayIndex })),
  );
  const hdKeyringsList = createMemo(() => walletState.keyrings().filter((k) => k.type === "hd"));
  const accountsForKeyring = (keyringId: string) =>
    accountRows().filter((r) => r.account.path !== "imported" && r.account.keyringId === keyringId);
  const importedAccountRows = () => accountRows().filter((r) => r.account.path === "imported");

  const beginDeleteKeyring = (kr: { id: string; label: string }) => {
    setPendingKeyringDelete({ id: kr.id, label: kr.label });
  };

  const proceedAfterConfirmDeleteKeyring = () => {
    const p = pendingKeyringDelete();
    setPendingKeyringDelete(null);
    if (!p) return;
    const isVault = walletState.storageMode() === "vault";
    if (isVault) {
      setDeleteKrId(p.id);
      setDeleteKrPw("");
      setDeleteKrError("");
      return;
    }
    void (async () => {
      setDeleteKrBusy(true);
      const ok = await walletState.deleteKeyring(p.id);
      setDeleteKrBusy(false);
      if (ok) closeDeleteKr();
    })();
  };

  const beginRemoveAccount = (accountIndex: number) => {
    const acc = walletState.accounts()[accountIndex];
    if (!acc) return;
    setPendingAccountRemoveIdx(accountIndex);
  };

  const proceedAfterConfirmRemoveAccount = () => {
    const idx = pendingAccountRemoveIdx();
    setPendingAccountRemoveIdx(null);
    if (idx == null) return;
    const isVault = walletState.storageMode() === "vault";
    if (isVault) {
      setRemoveAccIdx(idx);
      setRemoveAccPw("");
      setRemoveAccError("");
      return;
    }
    void (async () => {
      setRemoveAccBusy(true);
      const ok = await walletState.removeAccount(idx);
      setRemoveAccBusy(false);
      if (ok) closeAccountInfo();
    })();
  };

  const closeAccountInfo = () => {
    setAccountInfoIndex(null);
    setAccountInfoName("");
    setPkExportPassword("");
    setPkExportRevealed(false);
    setPkExportKey("");
    setPkExportError("");
    setPkShowKey(false);
    setPkExportLoading(false);
  };

  const closeWalletInfo = () => {
    setWalletInfoKeyringId(null);
    setWalletInfoLabel("");
    setWalletInfoError("");
    setMnExportPassword("");
    setMnExportRevealed(false);
    setMnExportWords([]);
    setMnExportError("");
    setMnBlurred(true);
    setMnExportLoading(false);
  };

  const saveAccountInfoName = async () => {
    const idx = accountInfoIndex();
    if (idx == null) return;
    const name = accountInfoName().trim();
    if (name.length < 1) return;
    await walletState.renameAccount(idx, name);
  };

  const saveWalletInfoName = async () => {
    const id = walletInfoKeyringId();
    if (!id) return;
    const label = walletInfoLabel().trim();
    if (label.length < 1) {
      setWalletInfoError("Enter a name");
      return;
    }
    setWalletInfoError("");
    setWalletInfoBusy(true);
    const ok = await walletState.renameKeyring(id, label);
    setWalletInfoBusy(false);
    if (ok) setWalletInfoError("");
  };

  const revealAccountPrivateKey = async () => {
    const idx = accountInfoIndex();
    if (idx == null) return;
    const acc = walletState.accounts()[idx];
    if (!acc) return;
    const isVault = walletState.storageMode() === "vault";
    if (isVault && pkExportPassword().length < 4) {
      setPkExportError("Enter your password");
      return;
    }
    setPkExportError("");
    setPkExportLoading(true);
    const res = await sendMessage({
      type: "EXPORT_PRIVATE_KEY",
      address: acc.address,
      ...(isVault ? { password: pkExportPassword() } : {}),
    });
    setPkExportLoading(false);
    if (!res.ok) {
      const friendly =
        res.error === "Wrong password" || res.error === "Authentication failed or cancelled"
          ? res.error
          : "Could not export private key";
      setPkExportError(friendly);
      if (friendly !== res.error) showError(friendly, res.error);
      return;
    }
    if (!res.data || !("privateKey" in res.data)) {
      setPkExportError("Could not export private key");
      return;
    }
    setPkExportKey(res.data.privateKey);
    setPkExportRevealed(true);
  };

  const revealWalletMnemonic = async () => {
    const kid = walletInfoKeyringId();
    if (!kid) return;
    const isVault = walletState.storageMode() === "vault";
    if (isVault && mnExportPassword().length < 4) {
      setMnExportError("Enter your password");
      return;
    }
    setMnExportError("");
    setMnExportLoading(true);
    const res = await sendMessage({
      type: "EXPORT_MNEMONIC",
      keyringId: kid,
      ...(isVault ? { password: mnExportPassword() } : {}),
    });
    setMnExportLoading(false);
    if (!res.ok) {
      const friendly =
        res.error === "Wrong password" || res.error === "Authentication failed or cancelled"
          ? res.error
          : "Could not export recovery phrase";
      setMnExportError(friendly);
      if (friendly !== res.error) showError(friendly, res.error);
      return;
    }
    if (!res.data || !("mnemonic" in res.data)) {
      setMnExportError("No recovery phrase for this wallet");
      return;
    }
    setMnExportWords(res.data.mnemonic.split(" "));
    setMnExportRevealed(true);
  };

  const openAccountInfo = (accountArrayIndex: number) => {
    const acc = walletState.accounts()[accountArrayIndex];
    if (!acc) return;
    setAccountInfoIndex(accountArrayIndex);
    setAccountInfoName(acc.name);
    setPkExportPassword("");
    setPkExportRevealed(false);
    setPkExportKey("");
    setPkExportError("");
    setPkShowKey(false);
  };

  const openWalletInfo = (kr: KeyringPublic) => {
    setWalletInfoKeyringId(kr.id);
    setWalletInfoLabel(kr.label);
    setWalletInfoError("");
    setMnExportPassword("");
    setMnExportRevealed(false);
    setMnExportWords([]);
    setMnExportError("");
    setMnBlurred(true);
  };

  const closeDeleteKr = () => {
    setDeleteKrId(null);
    setDeleteKrPw("");
    setDeleteKrError("");
    setDeleteKrBusy(false);
  };

  const confirmDeleteKr = async () => {
    const id = deleteKrId();
    if (!id) return;
    const isVault = walletState.storageMode() === "vault";
    if (isVault && deleteKrPw().length < 4) {
      setDeleteKrError("Enter your password");
      return;
    }
    setDeleteKrError("");
    setDeleteKrBusy(true);
    const ok = await walletState.deleteKeyring(id, isVault ? deleteKrPw() : undefined);
    setDeleteKrBusy(false);
    if (ok) closeDeleteKr();
  };

  const closeRemoveAcc = () => {
    setRemoveAccIdx(null);
    setRemoveAccPw("");
    setRemoveAccError("");
    setRemoveAccBusy(false);
  };

  const confirmRemoveAcc = async () => {
    const idx = removeAccIdx();
    if (idx == null) return;
    const isVault = walletState.storageMode() === "vault";
    if (isVault && removeAccPw().length < 4) {
      setRemoveAccError("Enter your password");
      return;
    }
    setRemoveAccError("");
    setRemoveAccBusy(true);
    const ok = await walletState.removeAccount(idx, isVault ? removeAccPw() : undefined);
    setRemoveAccBusy(false);
    if (ok) {
      closeAccountInfo();
      closeRemoveAcc();
    }
  };

  const closeAddMnemonicModal = () => {
    setShowAddMnemonicModal(false);
    setAddMnemonicShowPhrase(false);
    setAddMnemonicPhrase("");
    setAddMnemonicVaultPw("");
    setAddMnemonicBusy(false);
    setAddMnemonicError("");
  };

  const fillGeneratedMnemonic = () => {
    setAddMnemonicPhrase(generateMnemonic(english));
    setAddMnemonicError("");
  };

  const runAddMnemonicImport = async () => {
    const words = addMnemonicPhrase().trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      setAddMnemonicError("Enter a valid 12 or 24 word phrase");
      return;
    }
    const isVault = walletState.storageMode() === "vault";
    if (isVault && addMnemonicVaultPw().length < 4) {
      setAddMnemonicError("Enter your password");
      return;
    }
    setAddMnemonicError("");
    setAddMnemonicBusy(true);
    const ok = await walletState.addKeyringImport(
      addMnemonicPhrase().trim(),
      isVault ? addMnemonicVaultPw() : undefined,
    );
    setAddMnemonicBusy(false);
    if (ok) closeAddMnemonicModal();
  };

  const startDeriveInKeyring = (keyringId: string) => {
    if (walletState.storageMode() !== "vault") {
      void walletState.deriveInKeyring(keyringId);
      return;
    }
    setDeriveForKeyringId(keyringId);
    setDerivePassword("");
    setDeriveError("");
  };

  const confirmDeriveInKeyring = async (keyringId: string) => {
    if (derivePassword().length < 4) {
      setDeriveError("Enter your password");
      return;
    }
    setDeriveError("");
    const ok = await walletState.deriveInKeyring(keyringId, derivePassword());
    if (ok) {
      setDeriveForKeyringId(null);
      setDerivePassword("");
    }
  };

  const cancelDeriveInKeyring = () => {
    setDeriveForKeyringId(null);
    setDerivePassword("");
    setDeriveError("");
  };

  const closeImportPkModal = () => {
    setShowImportPkModal(false);
    setImportPkValue("");
    setImportPkVaultPw("");
    setImportPkBusy(false);
    setImportPkError("");
  };

  const fillGeneratedPrivateKey = () => {
    setImportPkValue(generatePrivateKey());
    setImportPkError("");
  };

  const pastePrivateKeyFromClipboard = async () => {
    try {
      let t = (await navigator.clipboard.readText()).trim();
      if (/^[0-9a-fA-F]{64}$/.test(t)) {
        t = `0x${t}`;
      }
      setImportPkValue(t);
      setImportPkError("");
    } catch {
      setImportPkError("Could not read clipboard — paste manually or check permissions.");
    }
  };

  const pasteMnemonicFromClipboard = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      setAddMnemonicPhrase(t);
      setAddMnemonicError("");
    } catch {
      setAddMnemonicError("Could not read clipboard — paste manually or check permissions.");
    }
  };

  const runImportPrivateKey = async () => {
    const pk = importPkValue().trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
      setImportPkError("Enter a valid private key (0x + 64 hex characters)");
      return;
    }
    const isVault = walletState.storageMode() === "vault";
    if (isVault && importPkVaultPw().length < 4) {
      setImportPkError("Enter your wallet password");
      return;
    }
    setImportPkError("");
    setImportPkBusy(true);
    const ok = await walletState.importPrivateKey(
      pk as `0x${string}`,
      isVault ? importPkVaultPw() : undefined,
    );
    setImportPkBusy(false);
    if (ok) closeImportPkModal();
  };

  return (
    <Card header="Wallets" padding={false}>
      <div class="divide-y divide-divider">
        <For each={hdKeyringsList()}>
          {(kr) => (
            <div class="border-b border-divider">
              <div class="flex items-center gap-0 w-full">
                {/** biome-ignore lint/a11y/useSemanticElements: i use role="button" for div as a wrapper to the button element */}
                <div
                  role="button"
                  aria-expanded={isKeyringExpanded(kr.id)}
                  aria-label={isKeyringExpanded(kr.id) ? "Collapse wallet" : "Expand wallet"}
                  onClick={() => toggleKeyringExpanded(kr.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleKeyringExpanded(kr.id);
                    }
                  }}
                  tabIndex={0}
                  class="group flex flex-1 min-w-0 items-center gap-3 px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
                >
                  <button
                    type="button"
                    class="shrink-0 p-0.5 text-text-tertiary group-hover:text-text-secondary rounded transition-colors cursor-pointer"
                  >
                    <ChevronRight
                      size={18}
                      class={`transition-transform ${isKeyringExpanded(kr.id) ? "rotate-90" : ""}`}
                    />
                  </button>
                  <span class={`w-2.5 h-2.5 rounded-full shrink-0 ${keyringDotClass(kr.id)}`} />
                  <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleKeyringExpanded(kr.id)}
                        class="min-w-0 text-sm font-semibold text-text-primary truncate text-left cursor-pointer"
                      >
                        {kr.label}
                      </button>
                      <button
                        type="button"
                        class="p-0.5 text-text-tertiary hover:text-accent transition-colors cursor-pointer shrink-0"
                        aria-label="Wallet details"
                        onClick={(e) => {
                          e.stopPropagation();
                          openWalletInfo(kr);
                        }}
                      >
                        <Info size={12} />
                      </button>
                    </div>
                    <div class="text-[11px] text-text-tertiary text-left w-full cursor-pointer group-hover:text-text-secondary transition-colors">
                      {accountsForKeyring(kr.id).length} account
                      {accountsForKeyring(kr.id).length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              </div>
              <Show when={isKeyringExpanded(kr.id)}>
                <div class="border-t border-divider/80 bg-base/20">
                  <For each={accountsForKeyring(kr.id)}>
                    {({ account: acc, accountArrayIndex: i }) => (
                      <AccountRow
                        acc={acc}
                        accountArrayIndex={i}
                        isActive={i === walletState.activeAccountIndex()}
                        onOpenInfo={() => openAccountInfo(i)}
                      />
                    )}
                  </For>
                  <Show
                    when={walletState.storageMode() === "vault" && deriveForKeyringId() === kr.id}
                  >
                    <div class="px-4 py-3 space-y-2 border-t border-divider/60">
                      <Input
                        type="password"
                        label="Wallet password"
                        placeholder="Password"
                        value={derivePassword()}
                        onInput={(v) => {
                          setDerivePassword(v);
                          setDeriveError("");
                        }}
                        error={deriveError() || undefined}
                        autoFocus
                      />
                      <div class="flex gap-2">
                        <Button size="sm" onClick={() => void confirmDeriveInKeyring(kr.id)}>
                          Add account
                        </Button>
                        <button
                          type="button"
                          onClick={cancelDeriveInKeyring}
                          class="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </Show>
                  <Show
                    when={
                      !(walletState.storageMode() === "vault" && deriveForKeyringId() === kr.id)
                    }
                  >
                    <div class="px-4 py-2 border-t border-divider/60">
                      <button
                        type="button"
                        onClick={() => startDeriveInKeyring(kr.id)}
                        class="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover cursor-pointer"
                      >
                        <Plus size={16} />
                        Add account
                      </button>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          )}
        </For>
        <div class="border-b border-divider last:border-b-0">
          <div class="flex items-center gap-0 w-full pr-1">
            <button
              type="button"
              aria-expanded={isKeyringExpanded(IMPORTED_KEYRING_ID)}
              aria-label={
                isKeyringExpanded(IMPORTED_KEYRING_ID)
                  ? "Collapse private key wallet"
                  : "Expand private key wallet"
              }
              onClick={() => toggleKeyringExpanded(IMPORTED_KEYRING_ID)}
              class="flex flex-1 min-w-0 items-center gap-3 px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer group"
            >
              <div class="shrink-0 p-0.5 text-text-tertiary group-hover:text-text-secondary rounded transition-colors cursor-pointer">
                <ChevronRight
                  size={18}
                  class={`transition-transform ${
                    isKeyringExpanded(IMPORTED_KEYRING_ID) ? "rotate-90" : ""
                  }`}
                />
              </div>
              <span
                class={`w-2.5 h-2.5 rounded-full shrink-0 ${keyringDotClass(IMPORTED_KEYRING_ID)}`}
              />
              <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 min-w-0">
                  <div class="min-w-0 text-sm font-semibold text-text-primary truncate text-left cursor-pointer">
                    Private key wallet
                  </div>
                </div>
                <div class="text-[11px] text-text-tertiary text-left w-full leading-snug cursor-pointer group-hover:text-text-secondary transition-colors">
                  <Switch>
                    <Match when={importedAccountRows().length === 0}>
                      Import accounts with a raw private key.
                    </Match>
                    <Match when={importedAccountRows().length === 1}>1 account</Match>
                    <Match when={importedAccountRows().length > 1}>
                      {importedAccountRows().length} accounts
                    </Match>
                  </Switch>
                </div>
              </div>
            </button>
          </div>
          <Show when={isKeyringExpanded(IMPORTED_KEYRING_ID)}>
            <div class="border-t border-divider/80 bg-base/20">
              <div>
                <For each={importedAccountRows()}>
                  {({ account: acc, accountArrayIndex: i }) => (
                    <AccountRow
                      acc={acc}
                      accountArrayIndex={i}
                      isActive={i === walletState.activeAccountIndex()}
                      onOpenInfo={() => openAccountInfo(i)}
                    />
                  )}
                </For>
                <Show when={importedAccountRows().length === 0}>
                  <p class="px-4 py-3 text-xs text-text-tertiary">No private-key accounts yet.</p>
                </Show>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportPkModal(true);
                  setImportPkError("");
                  setImportPkValue("");
                  setImportPkVaultPw("");
                }}
                class="flex items-center gap-2 w-full pl-8 pr-4 py-2.5 text-accent hover:bg-base/50 transition-colors cursor-pointer text-left border-b border-divider/60"
              >
                <Key size={16} class="shrink-0" />
                <span class="text-sm font-medium">Add private key</span>
              </button>
            </div>
          </Show>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowAddMnemonicModal(true);
            setAddMnemonicShowPhrase(false);
            setAddMnemonicError("");
          }}
          class="flex items-center gap-2 w-full px-4 py-3 text-accent hover:bg-base/50 transition-colors cursor-pointer border-t border-divider"
        >
          <Plus size={16} />
          <span class="text-sm font-medium">Add mnemonic wallet</span>
        </button>

        <Modal open={showImportPkModal()} onClose={closeImportPkModal} title="Add private key">
          <div class="p-4 space-y-3 max-h-[min(480px,70vh)] overflow-y-auto">
            <p class="text-xs text-text-secondary">
              Paste a key, generate a new one, or use the eye icon to reveal what you typed. Preview
              shows the first account address for this key.
            </p>
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span class="text-sm font-medium text-text-secondary">Private key</span>
                <div class="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    class="text-xs font-medium text-accent hover:text-accent-hover cursor-pointer"
                    onClick={() => void pastePrivateKeyFromClipboard()}
                  >
                    Paste
                  </button>
                  <button
                    type="button"
                    class="text-xs font-medium text-accent hover:text-accent-hover cursor-pointer"
                    onClick={fillGeneratedPrivateKey}
                  >
                    Generate new key
                  </button>
                </div>
              </div>
              <Input
                type="password"
                placeholder="0x…"
                value={importPkValue()}
                onInput={(v) => {
                  setImportPkValue(v);
                  setImportPkError("");
                }}
                mono
              />
            </div>
            <div
              class={`flex items-center gap-3 rounded-xl border border-divider bg-base px-3 py-2.5 ${
                importPkPreviewAddress() ? "" : "opacity-75"
              }`}
            >
              <Identicon address={importPkPreviewAddress() ?? zeroAddress} size={32} />
              <div class="min-w-0 w-full flex-1 overflow-hidden">
                <p class="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                  Preview
                </p>
                <p
                  class={`block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-mono ${
                    importPkPreviewAddress() ? "text-text-primary" : "text-text-tertiary"
                  }`}
                  title={importPkPreviewAddress() ?? undefined}
                >
                  {truncateAddressPreview(importPkPreviewAddress() ?? "")}
                </p>
              </div>
              <Show when={importPkPreviewAddress()}>
                {(addr) => <CopyButton text={addr()} size={14} />}
              </Show>
              <Show when={!importPkPreviewAddress()}>
                <div class="h-8 w-8 shrink-0" aria-hidden="true" />
              </Show>
            </div>
            <Show when={walletState.storageMode() === "vault"}>
              <Input
                type="password"
                label="Wallet password"
                placeholder="Password"
                value={importPkVaultPw()}
                onInput={(v) => {
                  setImportPkVaultPw(v);
                  setImportPkError("");
                }}
              />
            </Show>
            <Show when={importPkError()}>
              <p class="text-sm text-danger">{importPkError()}</p>
            </Show>
            <div class="flex flex-wrap gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={closeImportPkModal}>
                Cancel
              </Button>
              <Button onClick={() => void runImportPrivateKey()} loading={importPkBusy()}>
                <Show
                  when={walletState.storageMode() === "keychain"}
                  fallback={<span>Add account</span>}
                >
                  <span class="inline-flex items-center gap-1.5">
                    <Fingerprint size={18} />
                    Add account
                  </span>
                </Show>
              </Button>
            </div>
          </div>
        </Modal>

        <Modal open={accountInfoIndex() !== null} onClose={closeAccountInfo} title="Account">
          <div class="p-4 space-y-3 max-h-[min(520px,75vh)] overflow-y-auto">
            {(() => {
              const idx = accountInfoIndex();
              if (idx == null) return null;
              const acc = walletState.accounts()[idx];
              if (!acc) return null;
              return (
                <>
                  <Input
                    label="Name"
                    placeholder="Account name"
                    value={accountInfoName()}
                    onInput={setAccountInfoName}
                  />
                  <Button size="sm" variant="secondary" onClick={() => void saveAccountInfoName()}>
                    Save name
                  </Button>
                  <div>
                    <p class="text-xs text-text-secondary">Address</p>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="text-sm font-mono text-text-primary break-all">
                        {acc.address}
                      </span>
                      <CopyButton text={acc.address} size={14} />
                    </div>
                  </div>
                  <div>
                    <p class="text-xs text-text-secondary">Derivation path</p>
                    <p class="text-sm font-mono text-text-primary mt-0.5">{acc.path}</p>
                  </div>
                  <Banner variant="danger">
                    Never share your private key. Anyone with this key has full control of this
                    account.
                  </Banner>
                  <Show
                    when={pkExportRevealed()}
                    fallback={
                      <>
                        <Show when={walletState.storageMode() === "vault"}>
                          <Input
                            type="password"
                            label="Wallet password"
                            placeholder="Password"
                            value={pkExportPassword()}
                            onInput={(v) => {
                              setPkExportPassword(v);
                              setPkExportError("");
                            }}
                            error={pkExportError() || undefined}
                          />
                        </Show>
                        <Show when={walletState.storageMode() !== "vault" && pkExportError()}>
                          <Banner variant="danger">{pkExportError()}</Banner>
                        </Show>
                        <Button
                          onClick={() => void revealAccountPrivateKey()}
                          loading={pkExportLoading()}
                        >
                          <Show
                            when={walletState.storageMode() === "keychain"}
                            fallback="Reveal private key"
                          >
                            <span class="inline-flex items-center gap-1.5">
                              <Fingerprint size={16} />
                              Reveal private key
                            </span>
                          </Show>
                        </Button>
                      </>
                    }
                  >
                    <Card>
                      <div class="flex items-center justify-between mb-2">
                        <p class="text-xs text-text-secondary">Private key</p>
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPkShowKey(!pkShowKey())}
                            class="p-1 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                          >
                            <Show when={pkShowKey()} fallback={<Eye size={14} />}>
                              <EyeOff size={14} />
                            </Show>
                          </button>
                          <CopyButton text={pkExportKey()} size={14} />
                        </div>
                      </div>
                      <p class="font-mono text-xs text-text-primary break-all leading-relaxed select-all">
                        {pkShowKey() ? pkExportKey() : "\u2022".repeat(66)}
                      </p>
                    </Card>
                  </Show>
                  <div class="flex flex-wrap gap-2 pt-2 border-t border-divider">
                    <Button
                      variant="danger"
                      onClick={() => {
                        closeAccountInfo();
                        beginRemoveAccount(idx);
                      }}
                      disabled={walletState.accounts().length < 2}
                    >
                      Remove account
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>

        <Modal
          open={walletInfoKeyringId() !== null}
          onClose={closeWalletInfo}
          title="Mnemonic wallet"
        >
          <div class="p-4 space-y-3 max-h-[min(520px,75vh)] overflow-y-auto">
            <Input
              label="Name"
              placeholder="Wallet name"
              value={walletInfoLabel()}
              onInput={(v) => {
                setWalletInfoLabel(v);
                setWalletInfoError("");
              }}
            />
            <Show when={walletInfoError()}>
              <p class="text-sm text-danger">{walletInfoError()}</p>
            </Show>
            <div class="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void saveWalletInfoName()}
                loading={walletInfoBusy()}
              >
                Save name
              </Button>
            </div>
            <Banner variant="danger">
              Never share your recovery phrase. Anyone with these words can steal your funds.
            </Banner>
            <Show
              when={mnExportRevealed()}
              fallback={
                <>
                  <Show when={walletState.storageMode() === "vault"}>
                    <Input
                      type="password"
                      label="Wallet password"
                      placeholder="Password"
                      value={mnExportPassword()}
                      onInput={(v) => {
                        setMnExportPassword(v);
                        setMnExportError("");
                      }}
                      error={mnExportError() || undefined}
                    />
                  </Show>
                  <Show when={walletState.storageMode() !== "vault" && mnExportError()}>
                    <Banner variant="danger">{mnExportError()}</Banner>
                  </Show>
                  <Button onClick={() => void revealWalletMnemonic()} loading={mnExportLoading()}>
                    <Show
                      when={walletState.storageMode() === "keychain"}
                      fallback="Reveal recovery phrase"
                    >
                      <span class="inline-flex items-center gap-1.5">
                        <Fingerprint size={16} />
                        Reveal recovery phrase
                      </span>
                    </Show>
                  </Button>
                </>
              }
            >
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMnBlurred(!mnBlurred())}
                  class="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
                >
                  {mnBlurred() ? <Eye size={14} /> : <EyeOff size={14} />}
                  {mnBlurred() ? "Show words" : "Hide words"}
                </button>
                <CopyButton text={mnExportWords().join(" ")} size={14} />
              </div>
              <div
                class={`grid grid-cols-3 gap-2 transition-all duration-200 ${
                  mnBlurred() ? "blur-md select-none" : ""
                }`}
              >
                <For each={mnExportWords()}>
                  {(word, i) => (
                    <div class="flex items-center gap-1.5 bg-surface rounded-[var(--radius-chip)] px-2.5 py-2 shadow-sm">
                      <span class="text-xs text-text-tertiary w-4 text-right">{i() + 1}</span>
                      <span class="font-mono text-sm text-text-primary">{word}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <div class="flex flex-wrap gap-2 pt-2 border-t border-divider">
              <Button
                variant="danger"
                onClick={() => {
                  const id = walletInfoKeyringId();
                  if (!id) return;
                  const label = walletInfoLabel().trim();
                  const kr = walletState.keyrings().find((k) => k.id === id);
                  closeWalletInfo();
                  beginDeleteKeyring({ id, label: label || kr?.label || "" });
                }}
              >
                Delete wallet
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={pendingKeyringDelete() !== null}
          onClose={() => setPendingKeyringDelete(null)}
          title="Delete wallet?"
        >
          <div class="p-4 space-y-3">
            <p class="text-sm text-text-secondary">
              Delete &quot;{pendingKeyringDelete()?.label}&quot;? All accounts from this recovery
              phrase will be removed from this extension. This cannot be undone.
            </p>
            <div class="flex flex-wrap gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={() => setPendingKeyringDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={proceedAfterConfirmDeleteKeyring}>
                Delete wallet
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={pendingAccountRemoveIdx() !== null}
          onClose={() => setPendingAccountRemoveIdx(null)}
          title="Remove account?"
        >
          <div class="p-4 space-y-3">
            <p class="text-sm text-text-secondary">
              {(() => {
                const idx = pendingAccountRemoveIdx();
                if (idx == null) return "";
                const acc = walletState.accounts()[idx];
                if (!acc) return "";
                return `Remove "${acc.name}" (${truncateAddress(acc.address)}) from this extension? This cannot be undone.`;
              })()}
            </p>
            <div class="flex flex-wrap gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={() => setPendingAccountRemoveIdx(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={proceedAfterConfirmRemoveAccount}>
                Remove account
              </Button>
            </div>
          </div>
        </Modal>

        <Modal open={deleteKrId() !== null} onClose={closeDeleteKr} title="Delete wallet">
          <div class="p-4 space-y-3 max-h-[min(380px,70vh)] overflow-y-auto">
            <p class="text-sm text-text-secondary">
              This removes this recovery phrase and all accounts derived from it from this
              extension. Funds stay on-chain — this only affects keys stored on this device.
            </p>
            <Show when={walletState.storageMode() === "vault"}>
              <Input
                type="password"
                label="Wallet password"
                placeholder="Password"
                value={deleteKrPw()}
                onInput={(v) => {
                  setDeleteKrPw(v);
                  setDeleteKrError("");
                }}
              />
            </Show>
            <Show when={deleteKrError()}>
              <p class="text-sm text-danger">{deleteKrError()}</p>
            </Show>
            <div class="flex flex-wrap gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={closeDeleteKr}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void confirmDeleteKr()}
                loading={deleteKrBusy()}
              >
                Delete wallet
              </Button>
            </div>
          </div>
        </Modal>

        <Modal open={removeAccIdx() !== null} onClose={closeRemoveAcc} title="Remove account">
          <div class="p-4 space-y-3">
            <p class="text-sm text-text-secondary">
              Remove this account from the extension. Other accounts and recovery phrases are not
              affected.
            </p>
            <Show when={walletState.storageMode() === "vault"}>
              <Input
                type="password"
                label="Wallet password"
                placeholder="Password"
                value={removeAccPw()}
                onInput={(v) => {
                  setRemoveAccPw(v);
                  setRemoveAccError("");
                }}
              />
            </Show>
            <Show when={removeAccError()}>
              <p class="text-sm text-danger">{removeAccError()}</p>
            </Show>
            <div class="flex flex-wrap gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={closeRemoveAcc}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void confirmRemoveAcc()}
                loading={removeAccBusy()}
              >
                Remove account
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={showAddMnemonicModal()}
          onClose={closeAddMnemonicModal}
          title="Add mnemonic wallet"
        >
          <div class="p-4 space-y-3 max-h-[min(480px,70vh)] overflow-y-auto">
            <p class="text-xs text-text-secondary">
              Paste a phrase, generate one, or use Show in the field to reveal what you typed.
              Preview shows the first account for this phrase.
            </p>
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span class="text-sm font-medium text-text-secondary">Recovery phrase</span>
                <div class="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    class="text-xs font-medium text-accent hover:text-accent-hover cursor-pointer"
                    onClick={() => void pasteMnemonicFromClipboard()}
                  >
                    Paste
                  </button>
                  <button
                    type="button"
                    disabled={addMnemonicBusy()}
                    class="text-xs font-medium text-accent hover:text-accent-hover cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={fillGeneratedMnemonic}
                  >
                    Generate mnemonic
                  </button>
                </div>
              </div>
              <Input
                multiline
                rows={4}
                mono
                secure={!addMnemonicShowPhrase()}
                placeholder="12 or 24 words"
                value={addMnemonicPhrase()}
                onInput={(v) => {
                  setAddMnemonicPhrase(v);
                  setAddMnemonicError("");
                }}
                bottomRightSlot={
                  <>
                    <button
                      type="button"
                      class="text-xs font-medium text-accent hover:text-accent-hover"
                      onClick={() => setAddMnemonicShowPhrase(!addMnemonicShowPhrase())}
                    >
                      {addMnemonicShowPhrase() ? "Hide" : "Show"}
                    </button>
                    <Show when={addMnemonicPhrase().trim()}>
                      <CopyButton text={addMnemonicPhrase()} size={14} />
                    </Show>
                  </>
                }
              />
            </div>
            <div
              class={`flex items-center gap-3 rounded-xl border border-divider bg-base px-3 py-2.5 ${
                addMnemonicPreviewAddress() ? "" : "opacity-75"
              }`}
            >
              <Identicon address={addMnemonicPreviewAddress() ?? zeroAddress} size={32} />
              <div class="min-w-0 w-full flex-1 overflow-hidden">
                <p class="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                  Preview (first account)
                </p>
                <p
                  class={`block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-mono ${
                    addMnemonicPreviewAddress() ? "text-text-primary" : "text-text-tertiary"
                  }`}
                  title={addMnemonicPreviewAddress() ?? undefined}
                >
                  {truncateAddressPreview(addMnemonicPreviewAddress() ?? "")}
                </p>
              </div>
              <Show when={addMnemonicPreviewAddress()}>
                {(addr) => <CopyButton text={addr()} size={14} />}
              </Show>
              <Show when={!addMnemonicPreviewAddress()}>
                <div class="h-8 w-8 shrink-0" aria-hidden="true" />
              </Show>
            </div>
            <Show when={walletState.storageMode() === "vault"}>
              <Input
                type="password"
                label="Wallet password"
                placeholder="Password"
                value={addMnemonicVaultPw()}
                onInput={(v) => {
                  setAddMnemonicVaultPw(v);
                  setAddMnemonicError("");
                }}
              />
            </Show>
            <Show when={addMnemonicError()}>
              <p class="text-sm text-danger">{addMnemonicError()}</p>
            </Show>
            <div class="flex flex-wrap gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={closeAddMnemonicModal}>
                Cancel
              </Button>
              <Button onClick={() => void runAddMnemonicImport()} loading={addMnemonicBusy()}>
                Import wallet
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Card>
  );
}
