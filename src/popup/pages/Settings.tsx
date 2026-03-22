import { truncateAddress } from "@shared/format";
import { sendMessage } from "@shared/messages";
import { useNavigate } from "@solidjs/router";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ExternalLink,
  Fingerprint,
  Key,
  Moon,
  Pencil,
  Plus,
  ShieldCheck,
  Sun,
  Trash2,
  X,
  Zap,
} from "lucide-solid";
import { createSignal, For, onMount, Show } from "solid-js";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChainIcon } from "../components/ChainIcon";
import { CopyButton } from "../components/CopyButton";
import { Header } from "../components/Header";
import { Identicon } from "../components/Identicon";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import {
  setActivity,
  setActivityHasMore,
  setActivitySource,
  setShowNetworkSelector,
  showNetworkSelector,
  walletState,
} from "../store";
import { NetworkSelector } from "./NetworkSelector";

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
  const navigate = useNavigate();
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [editName, setEditName] = createSignal("");
  const [addingAccount, setAddingAccount] = createSignal(false);
  const [addPassword, setAddPassword] = createSignal("");
  const [addError, setAddError] = createSignal("");

  const handleAddAccount = async () => {
    const isVault = walletState.storageMode() === "vault";
    if (isVault && !addingAccount()) {
      setAddingAccount(true);
      return;
    }
    if (isVault && addPassword().length < 4) {
      setAddError("Enter your password");
      return;
    }
    setAddError("");
    await walletState.addAccount(isVault ? addPassword() : undefined);
    setAddingAccount(false);
    setAddPassword("");
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Settings" onBack="/home" />

      <div class="flex-1 overflow-y-auto px-4 pt-2 space-y-4 pb-4">
        {/* Accounts */}
        <Card header="Accounts" padding={false}>
          <div class="divide-y divide-divider">
            <For each={walletState.accounts()}>
              {(acc, i) => (
                <button
                  type="button"
                  onClick={() => walletState.switchAccount(i())}
                  class={`flex items-center gap-3 w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left
                  ${i() === walletState.activeAccountIndex() ? "bg-accent-light" : ""}`}
                >
                  <Identicon address={acc.address} size={32} />
                  <div class="flex-1 min-w-0">
                    {editingIndex() === i() ? (
                      <div class="flex items-center gap-1">
                        <input
                          class="text-sm font-semibold text-text-primary bg-transparent outline-none w-full py-0 shadow-[0_1px_0_0_var(--color-accent)]"
                          value={editName()}
                          onClick={(e) => e.stopPropagation()}
                          onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              walletState.renameAccount(i(), editName().trim() || acc.name);
                              setEditingIndex(null);
                            }
                            if (e.key === "Escape") setEditingIndex(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            walletState.renameAccount(i(), editName().trim() || acc.name);
                            setEditingIndex(null);
                          }}
                          class="p-0.5 text-accent hover:text-accent-hover cursor-pointer shrink-0"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div class="flex items-center gap-1.5">
                        <p class="text-sm font-semibold text-text-primary">{acc.name}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingIndex(i());
                            setEditName(acc.name);
                          }}
                          class="p-0.5 text-text-tertiary hover:text-accent transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                    <div class="flex items-center gap-1 mt-0.5">
                      <span class="text-xs font-mono font-medium text-text-primary/70 truncate">
                        {truncateAddress(acc.address)}
                      </span>
                      <CopyButton text={acc.address} size={12} />
                    </div>
                    <p class="text-[10px] font-mono text-text-tertiary mt-1">{acc.path}</p>
                  </div>
                  {i() === walletState.activeAccountIndex() && (
                    <div class="w-2 h-2 rounded-full bg-accent shrink-0" />
                  )}
                </button>
              )}
            </For>
            {addingAccount() ? (
              <div class="px-4 py-3 space-y-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={addPassword()}
                  onInput={(v) => {
                    setAddPassword(v);
                    setAddError("");
                  }}
                  error={addError() || undefined}
                  autoFocus
                />
                <div class="flex gap-2">
                  <Button size="sm" onClick={handleAddAccount}>
                    Add
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingAccount(false);
                      setAddPassword("");
                      setAddError("");
                    }}
                    class="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAddAccount}
                class="flex items-center gap-2 w-full px-4 py-3 text-accent hover:bg-base/50 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                <span class="text-sm font-medium">Add Account</span>
              </button>
            )}
          </div>
        </Card>

        {/* Network */}
        <Card header="Network" padding={false}>
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
        </Card>

        {/* API Keys */}
        <ApiKeysSection />

        {/* Theme */}
        <ThemeSelector />

        {/* Data */}
        <ClearCacheRow />

        {/* Security */}
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

        {/* Reset */}
        <ResetWalletRow />
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
    setActivity([]);
    setActivitySource(null);
    setActivityHasMore(false);
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
        setResetting(false);
        return;
      }
      localStorage.removeItem("lion-theme");
      document.documentElement.removeAttribute("data-theme");
      navigate("/", { replace: true });
    } catch {
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
