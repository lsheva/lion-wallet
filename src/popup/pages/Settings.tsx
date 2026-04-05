import { getExtensionVersion } from "@shared/extension-version";
import { toErrorMessage, truncateAddress, truncateAddressPreview } from "@shared/format";
import { IMPORTED_KEYRING_ID } from "@shared/keyring-constants";
import { sendMessage } from "@shared/messages";
import type { KeyringPublic, SerializedAccount } from "@shared/types";
import {
  AlertTriangle,
  ArrowUpCircle,
  BookUser,
  Check,
  ChevronRight,
  ExternalLink,
  Fingerprint,
  Globe,
  Key,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  X,
  Zap,
} from "lucide-solid";
import { createMemo, createSignal, For, Match, onMount, Show, Switch } from "solid-js";
import { type Address, zeroAddress } from "viem";
import {
  english,
  generateMnemonic,
  generatePrivateKey,
  mnemonicToAccount,
  privateKeyToAccount,
} from "viem/accounts";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChainIcon } from "../components/ChainIcon";
import { CopyButton } from "../components/CopyButton";
import { Header } from "../components/Header";
import { Identicon } from "../components/Identicon";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { keyringDotClass } from "../keyring-ui";
import { useNavigate } from "../router";
import {
  clearPopupCache,
  setShowNetworkSelector,
  showNetworkSelector,
  walletState,
} from "../store";
import { showError } from "../toast";
import { NetworkSelector } from "./NetworkSelector";

function AccountRow(props: {
  acc: SerializedAccount;
  accountArrayIndex: number;
  isActive: boolean;
  isEditing: boolean;
  editName: string;
  onEditName: (v: string) => void;
  onConfirmEdit: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  canRemove: boolean;
  onRequestRemove: () => void;
  removeBusy?: boolean;
}) {
  return (
    <div
      class={`flex items-center gap-1 w-full pl-8 pr-4 py-2.5 hover:bg-base/50 transition-colors
        ${props.isActive ? "bg-accent-light/80" : ""}`}
    >
      <button
        type="button"
        onClick={() => walletState.switchAccount(props.accountArrayIndex)}
        class="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer"
      >
        <Identicon address={props.acc.address} size={28} />
        <div class="flex-1 min-w-0">
          {props.isEditing ? (
            <div class="flex items-center gap-1">
              <input
                class="text-sm font-semibold text-text-primary bg-transparent outline-none w-full py-0 shadow-[0_1px_0_0_var(--color-accent)]"
                value={props.editName}
                onClick={(e) => e.stopPropagation()}
                onInput={(e) => props.onEditName((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") props.onConfirmEdit();
                  if (e.key === "Escape") props.onCancelEdit();
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onConfirmEdit();
                }}
                class="p-0.5 text-accent hover:text-accent-hover cursor-pointer shrink-0"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div class="flex items-center gap-1.5">
              <p class="text-sm font-semibold text-text-primary">{props.acc.name}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onStartEdit();
                }}
                class="p-0.5 text-text-tertiary hover:text-accent transition-colors cursor-pointer shrink-0"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
          <div class="flex items-center gap-1 mt-0.5">
            <span class="text-[11px] font-mono font-medium text-text-primary/70 truncate">
              {truncateAddress(props.acc.address)}
            </span>
            <CopyButton text={props.acc.address} size={12} />
          </div>
          <p class="text-[10px] font-mono text-text-tertiary mt-0.5">{props.acc.path}</p>
        </div>
      </button>
      <Show when={props.canRemove}>
        <button
          type="button"
          disabled={props.removeBusy}
          onClick={(e) => {
            e.stopPropagation();
            props.onRequestRemove();
          }}
          class="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Remove account"
        >
          <Trash2 size={16} />
        </button>
      </Show>
    </div>
  );
}

function SettingsRow(props: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left"
    >
      <span class="text-sm text-text-primary">{props.label}</span>
      <ChevronRight size={16} class="text-text-tertiary" />
    </button>
  );
}

export function Settings() {
  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Settings" onBack="/home" />

      <div class="flex-1 overflow-y-auto px-4 pt-2 space-y-4 pb-4">
        <WalletAndAccounts />
        <Network />
        <AddressBook />
        <Connections />
        <ApiKeysSection />
        <ThemeSelector />
        <ClearCacheRow />
        <Security />
        <ResetWalletRow />
        <UpdateSection />
      </div>

      <Show when={showNetworkSelector()}>
        <NetworkSelector />
      </Show>
    </div>
  );
}

type ThemePref = "system" | "light" | "dark";

function getThemePref(): ThemePref {
  const stored = localStorage.getItem("lion-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

function applyTheme(pref: ThemePref) {
  localStorage.setItem("lion-theme", pref);
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", pref);
  }
}

function Security() {
  const navigate = useNavigate();

  return (
    <Card header="Security" padding={false}>
      <div class="divide-y divide-divider">
        <div class="flex items-center gap-2 px-4 py-3">
          {walletState.storageMode() === "keychain" ? (
            <>
              <Fingerprint size={16} class="text-accent" />
              <span class="text-sm text-text-primary">Secured by Touch ID</span>
            </>
          ) : (
            <>
              <ShieldCheck size={16} class="text-accent" />
              <span class="text-sm text-text-primary">Secured by password</span>
            </>
          )}
        </div>
        <SettingsRow
          label="Export Private Key"
          onClick={() => navigate("/export-key", { replace: true })}
        />
        <SettingsRow
          label="Show Recovery Phrase"
          onClick={() => navigate("/show-phrase", { replace: true })}
        />
      </div>
    </Card>
  );
}

function Connections() {
  const navigate = useNavigate();

  return (
    <Card header="Connections" padding={false}>
      <button
        type="button"
        onClick={() => navigate("/settings/connected-sites", { replace: true })}
        class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-2">
          <Globe size={16} class="text-text-tertiary" />
          <span class="text-sm text-text-primary">Connected sites</span>
        </div>
        <ChevronRight size={16} class="text-text-tertiary" />
      </button>
    </Card>
  );
}

function AddressBook() {
  const navigate = useNavigate();

  return (
    <Card header="Address Book" padding={false}>
      <button
        type="button"
        onClick={() => navigate("/address-book", { replace: true })}
        class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-2">
          <BookUser size={16} class="text-text-tertiary" />
          <span class="text-sm text-text-primary">Saved Addresses</span>
        </div>
        <ChevronRight size={16} class="text-text-tertiary" />
      </button>
    </Card>
  );
}

function Network() {
  return (
    <Card header="Network" padding={false}>
      <div class="divide-y divide-divider">
        <button
          type="button"
          onClick={() => setShowNetworkSelector(true)}
          class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2">
            <ChainIcon chainId={walletState.activeNetwork().id} size={16} />
            <span class="text-sm text-text-primary">{walletState.activeNetwork().name}</span>
          </div>
          <ChevronRight size={16} class="text-text-tertiary" />
        </button>
        <Show when={walletState.accounts().some((a) => a.path !== "imported")}>
          <button
            type="button"
            onClick={() => void walletState.refreshChainDiscovery()}
            disabled={walletState.chainDiscoveryScanning()}
            class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div class="flex items-center gap-2">
              <RefreshCw
                size={16}
                class={
                  walletState.chainDiscoveryScanning()
                    ? "text-accent animate-spin"
                    : "text-text-tertiary"
                }
              />
              <span class="text-sm text-text-primary">Re-scan chain activity</span>
            </div>
            <span class="text-[11px] text-text-tertiary">balances &amp; tx count</span>
          </button>
        </Show>
      </div>
    </Card>
  );
}

function ThemeSelector() {
  const [theme, setTheme] = createSignal<ThemePref>(getThemePref());

  const options: Array<{ value: ThemePref; label: string; Icon: typeof Sun }> = [
    { value: "system", label: "System", Icon: Sun },
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
  ];

  return (
    <Card header="Appearance" padding={false}>
      <div class="flex px-4 py-3 gap-2">
        <For each={options}>
          {({ value, label }) => (
            <button
              type="button"
              onClick={() => {
                setTheme(value);
                applyTheme(value);
              }}
              class={`flex-1 py-1.5 text-xs font-medium rounded-[var(--radius-chip)] transition-colors cursor-pointer ${
                theme() === value
                  ? "bg-accent text-accent-foreground"
                  : "bg-base text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          )}
        </For>
      </div>
    </Card>
  );
}

function ClearCacheRow() {
  const [cleared, setCleared] = createSignal(false);
  const [clearError, setClearError] = createSignal(false);

  const handleClear = async () => {
    if (cleared()) return;
    setClearError(false);
    const res = await sendMessage({ type: "CLEAR_ACTIVITY_CACHE" });
    if (!res.ok) {
      setClearError(true);
      setTimeout(() => setClearError(false), 3000);
      return;
    }
    clearPopupCache();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <Card header="Data" padding={false}>
      <button
        type="button"
        onClick={handleClear}
        class={`flex items-center gap-2 w-full px-4 py-3 transition-colors cursor-pointer text-left ${
          clearError() ? "text-danger" : cleared() ? "text-success" : "text-danger hover:bg-base/50"
        }`}
      >
        {cleared() ? <Check size={16} /> : <Trash2 size={16} />}
        <span class="text-sm font-medium">
          {clearError()
            ? "Failed to clear cache"
            : cleared()
              ? "Activity Cache Cleared"
              : "Clear Activity Cache"}
        </span>
      </button>
    </Card>
  );
}

function ApiKeyRow(props: {
  icon: typeof Key;
  label: string;
  currentKey: string | null;
  dashboardUrl: string;
  dashboardLabel: string;
  onSave: (key: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const Icon = props.icon;
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const maskedKey = () =>
    props.currentKey ? `${props.currentKey.slice(0, 4)}${"•".repeat(8)}` : "Not set";

  const handleSave = async () => {
    setSaving(true);
    await props.onSave(editValue().trim());
    setEditing(false);
    setSaving(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    await props.onRemove();
    setEditing(false);
    setEditValue("");
    setSaving(false);
  };

  return (
    <>
      {editing() ? (
        <div class="px-4 py-3 space-y-2">
          <Input
            label={props.label}
            placeholder="Paste your API key"
            value={editValue()}
            onInput={setEditValue}
            mono
            autoFocus
          />
          <a
            href={props.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors"
          >
            {props.dashboardLabel}
            <ExternalLink size={10} />
          </a>
          <div class="flex gap-2">
            <Button size="sm" onClick={handleSave} loading={saving()}>
              Save
            </Button>
            {props.currentKey && (
              <Button size="sm" variant="ghost" onClick={handleRemove} loading={saving()}>
                Remove
              </Button>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              class="ml-auto text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditValue(props.currentKey ?? "");
            setEditing(true);
          }}
          class="flex items-center justify-between w-full px-4 py-3 cursor-pointer text-left hover:bg-base/50 transition-colors"
        >
          <div class="flex items-center gap-2">
            <Icon size={16} class="text-text-tertiary" />
            <div>
              <p class="text-sm text-text-primary">{props.label}</p>
              <p class="text-xs font-mono text-text-tertiary">{maskedKey()}</p>
            </div>
          </div>
          <ChevronRight size={16} class="text-text-tertiary" />
        </button>
      )}
    </>
  );
}

function ApiKeysSection() {
  const [alchemyKey, setAlchemyKey] = createSignal<string | null>(null);
  const [etherscanKey, setEtherscanKey] = createSignal<string | null>(null);

  onMount(() => {
    sendMessage({ type: "GET_RPC_PROVIDER_KEY" }).then((res) => {
      if (res.ok && res.data) {
        setAlchemyKey(res.data.key);
      }
    });
    sendMessage({ type: "GET_ETHERSCAN_KEY" }).then((res) => {
      if (res.ok && res.data) {
        setEtherscanKey(res.data.key);
      }
    });
  });

  return (
    <Card header="API Keys" padding={false}>
      <div class="divide-y divide-divider">
        <ApiKeyRow
          icon={Zap}
          label="Alchemy RPC Key"
          currentKey={alchemyKey()}
          dashboardUrl="https://dashboard.alchemy.com/"
          dashboardLabel="Get a key"
          onSave={async (key) => {
            await sendMessage({ type: "SET_RPC_PROVIDER_KEY", key });
            setAlchemyKey(key || null);
          }}
          onRemove={async () => {
            await sendMessage({ type: "SET_RPC_PROVIDER_KEY", key: "" });
            setAlchemyKey(null);
          }}
        />
        <ApiKeyRow
          icon={Key}
          label="Etherscan API Key"
          currentKey={etherscanKey()}
          dashboardUrl="https://etherscan.io/myapikey"
          dashboardLabel="Get a key"
          onSave={async (key) => {
            await sendMessage({ type: "SET_ETHERSCAN_KEY", key });
            setEtherscanKey(key || null);
          }}
          onRemove={async () => {
            await sendMessage({ type: "SET_ETHERSCAN_KEY", key: "" });
            setEtherscanKey(null);
          }}
        />
      </div>
    </Card>
  );
}

const currentVersion = getExtensionVersion();

function UpdateSection() {
  const [latest, setLatest] = createSignal("");
  const [downloadUrl, setDownloadUrl] = createSignal("");
  const [updateAvailable, setUpdateAvailable] = createSignal(false);
  const [checking, setChecking] = createSignal(false);

  const doCheck = async (force = false) => {
    setChecking(true);
    try {
      const res = await sendMessage({ type: "CHECK_UPDATE", force });
      if (res.ok && res.data) {
        setLatest(res.data.latest);
        setDownloadUrl(res.data.downloadUrl);
        setUpdateAvailable(res.data.updateAvailable);
      }
    } finally {
      setChecking(false);
    }
  };

  onMount(() => doCheck());

  return (
    <Card header="About" padding={false}>
      <div class="px-4 py-3 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-primary">
            Lion Wallet <span class="font-mono text-text-tertiary">v{currentVersion}</span>
          </span>
          <button
            type="button"
            onClick={() => doCheck(true)}
            disabled={checking()}
            class="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} class={checking() ? "animate-spin" : ""} />
          </button>
        </div>

        <Show when={updateAvailable()}>
          <a
            href={downloadUrl()}
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            <ArrowUpCircle size={16} class="text-accent shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-accent">Update available</p>
              <p class="text-xs text-text-tertiary">v{latest()} — tap to download</p>
            </div>
            <ExternalLink size={12} class="text-accent shrink-0" />
          </a>
        </Show>
      </div>
    </Card>
  );
}

function ResetWalletRow() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = createSignal(false);
  const [step, setStep] = createSignal<1 | 2>(1);
  const [password, setPassword] = createSignal("");
  const [confirmText, setConfirmText] = createSignal("");
  const [error, setError] = createSignal("");
  const [resetting, setResetting] = createSignal(false);

  const close = () => {
    setShowModal(false);
    setStep(1);
    setPassword("");
    setConfirmText("");
    setError("");
  };

  const handleReset = async () => {
    const isVault = walletState.storageMode() === "vault";
    if (isVault && password().length < 4) {
      setError("Enter your password");
      return;
    }
    setError("");
    setResetting(true);
    try {
      const res = await sendMessage({
        type: "RESET_WALLET",
        ...(isVault ? { password: password() } : {}),
      });
      if (!res.ok) {
        setError(res.error);
        showError("Could not reset wallet", res.error);
        setResetting(false);
        return;
      }
      clearPopupCache();
      localStorage.removeItem("lion-theme");
      document.documentElement.removeAttribute("data-theme");
      navigate("/", { replace: true });
    } catch (e) {
      showError("Could not reset wallet", toErrorMessage(e));
      setResetting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        class="flex items-center justify-center gap-2 w-full py-3 text-danger hover:text-danger-hover transition-colors cursor-pointer"
      >
        <Trash2 size={16} />
        <span class="text-sm font-medium">Reset Wallet</span>
      </button>

      <Modal open={showModal()} onClose={close} title="Reset Wallet">
        {step() === 1 ? (
          <div class="p-4 space-y-4">
            <div class="flex items-start gap-3 p-3 rounded-xl bg-danger/10">
              <AlertTriangle size={20} class="text-danger shrink-0 mt-0.5" />
              <p class="text-sm text-text-primary leading-relaxed">
                This will permanently delete your recovery phrase, all accounts, and all settings
                from this device. If you haven't backed up your recovery phrase, your funds will be
                lost forever.
              </p>
            </div>
            <div class="flex gap-2">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div class="p-4 space-y-4">
            {walletState.storageMode() === "vault" && (
              <Input
                label="Enter password to continue"
                type="password"
                placeholder="Password"
                value={password()}
                onInput={(v) => {
                  setPassword(v);
                  setError("");
                }}
                error={error() || undefined}
                autoFocus
              />
            )}
            {walletState.storageMode() !== "vault" && error() && (
              <div class="flex items-start gap-3 p-3 rounded-xl bg-danger/10">
                <AlertTriangle size={16} class="text-danger shrink-0 mt-0.5" />
                <p class="text-sm text-danger">{error()}</p>
              </div>
            )}
            <div>
              <p class="text-sm text-text-secondary mb-2">
                Type <span class="font-semibold text-text-primary">RESET</span> to confirm.
              </p>
              <Input
                placeholder="Type RESET"
                value={confirmText()}
                onInput={setConfirmText}
                autoFocus={walletState.storageMode() !== "vault"}
              />
            </div>
            <div class="flex gap-2">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={confirmText() !== "RESET"}
                loading={resetting()}
                onClick={handleReset}
              >
                {walletState.storageMode() === "vault" ? (
                  "Reset Wallet"
                ) : (
                  <span class="inline-flex items-center gap-1.5">
                    <Fingerprint size={16} />
                    Reset Wallet
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function WalletAndAccounts() {
  const isKeyringExpanded = (id: string) => expandedKeyringIds().has(id);

  const [expandedKeyringIds, setExpandedKeyringIds] = createSignal<Set<string>>(new Set());
  const toggleKeyringExpanded = (id: string) => {
    setExpandedKeyringIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [renameKrId, setRenameKrId] = createSignal<string | null>(null);
  const [renameKrLabel, setRenameKrLabel] = createSignal("");
  const [renameKrBusy, setRenameKrBusy] = createSignal(false);
  const [renameKrError, setRenameKrError] = createSignal("");

  const [deleteKrId, setDeleteKrId] = createSignal<string | null>(null);
  const [deleteKrPw, setDeleteKrPw] = createSignal("");
  const [deleteKrBusy, setDeleteKrBusy] = createSignal(false);
  const [deleteKrError, setDeleteKrError] = createSignal("");

  const [removeAccIdx, setRemoveAccIdx] = createSignal<number | null>(null);
  const [removeAccPw, setRemoveAccPw] = createSignal("");
  const [removeAccBusy, setRemoveAccBusy] = createSignal(false);
  const [removeAccError, setRemoveAccError] = createSignal("");

  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [editName, setEditName] = createSignal("");
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
      if (ok) setEditingIndex(null);
    })();
  };

  const closeRenameKr = () => {
    setRenameKrId(null);
    setRenameKrLabel("");
    setRenameKrError("");
    setRenameKrBusy(false);
  };

  const confirmRenameKr = async () => {
    const id = renameKrId();
    if (!id) return;
    const label = renameKrLabel().trim();
    if (label.length < 1) {
      setRenameKrError("Enter a name");
      return;
    }
    setRenameKrError("");
    setRenameKrBusy(true);
    const ok = await walletState.renameKeyring(id, label);
    setRenameKrBusy(false);
    if (ok) closeRenameKr();
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
      setEditingIndex(null);
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
                        aria-label="Rename wallet"
                        onClick={() => {
                          setRenameKrId(kr.id);
                          setRenameKrLabel(kr.label);
                          setRenameKrError("");
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                    <div class="text-[11px] text-text-tertiary text-left w-full cursor-pointer group-hover:text-text-secondary transition-colors">
                      {accountsForKeyring(kr.id).length} account
                      {accountsForKeyring(kr.id).length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deleteKrBusy()}
                    onClick={(e) => {
                      e.stopPropagation();
                      beginDeleteKeyring(kr);
                    }}
                    class="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Delete wallet"
                  >
                    <Trash2 size={16} />
                  </button>
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
                        isEditing={editingIndex() === i}
                        editName={editName()}
                        onEditName={setEditName}
                        onConfirmEdit={() => {
                          void walletState.renameAccount(i, editName().trim() || acc.name);
                          setEditingIndex(null);
                        }}
                        onStartEdit={() => {
                          setEditingIndex(i);
                          setEditName(acc.name);
                        }}
                        onCancelEdit={() => setEditingIndex(null)}
                        canRemove={walletState.accounts().length > 1}
                        removeBusy={removeAccBusy()}
                        onRequestRemove={() => beginRemoveAccount(i)}
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
                      isEditing={editingIndex() === i}
                      editName={editName()}
                      onEditName={setEditName}
                      onConfirmEdit={() => {
                        void walletState.renameAccount(i, editName().trim() || acc.name);
                        setEditingIndex(null);
                      }}
                      onStartEdit={() => {
                        setEditingIndex(i);
                        setEditName(acc.name);
                      }}
                      onCancelEdit={() => setEditingIndex(null)}
                      canRemove={walletState.accounts().length > 1}
                      removeBusy={removeAccBusy()}
                      onRequestRemove={() => beginRemoveAccount(i)}
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
                class="flex items-center gap-2 w-full px-4 py-2.5 text-accent hover:bg-base/50 transition-colors cursor-pointer text-left border-b border-divider/60"
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

        <Modal open={renameKrId() !== null} onClose={closeRenameKr} title="Rename wallet">
          <div class="p-4 space-y-3">
            <Input
              label="Name"
              placeholder="Wallet name"
              value={renameKrLabel()}
              onInput={(v) => {
                setRenameKrLabel(v);
                setRenameKrError("");
              }}
              autoFocus
            />
            <Show when={renameKrError()}>
              <p class="text-sm text-danger">{renameKrError()}</p>
            </Show>
            <div class="flex flex-wrap gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={closeRenameKr}>
                Cancel
              </Button>
              <Button onClick={() => void confirmRenameKr()} loading={renameKrBusy()}>
                Save
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
