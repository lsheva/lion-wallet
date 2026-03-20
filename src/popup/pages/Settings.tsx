import { useState, useEffect } from "preact/hooks";
import { route } from "preact-router";
import { ChevronRight, Plus, Pencil, Check, Key, Zap, X, ExternalLink, Fingerprint, ShieldCheck, Trash2 } from "lucide-preact";
import { Header } from "../components/Header";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Identicon } from "../components/Identicon";
import { CopyButton } from "../components/CopyButton";
import { Button } from "../components/Button";
import { walletState, showNetworkSelector } from "../store";
import { sendMessage } from "@shared/messages";
import { NetworkSelector } from "./NetworkSelector";
import { ChainIcon } from "../components/ChainIcon";

function SettingsRow({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left"
    >
      <span class="text-sm text-text-primary">{label}</span>
      <ChevronRight size={16} class="text-text-tertiary" />
    </button>
  );
}

export function Settings() {
  const accounts = walletState.accounts.value;
  const network = walletState.activeNetwork.value;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [addPassword, setAddPassword] = useState("");
  const [addError, setAddError] = useState("");

  const isVaultMode = walletState.storageMode.value === "vault";

  const handleAddAccount = async () => {
    if (isVaultMode && !addingAccount) {
      setAddingAccount(true);
      return;
    }
    if (isVaultMode && addPassword.length < 4) {
      setAddError("Enter your password");
      return;
    }
    setAddError("");
    await walletState.addAccount(isVaultMode ? addPassword : undefined);
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
            {accounts.map((acc, i) => (
              <button
                type="button"
                key={acc.address}
                onClick={() => walletState.switchAccount(i)}
                class={`flex items-center gap-3 w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left
                  ${i === walletState.activeAccountIndex.value ? "bg-accent-light" : ""}`}
              >
                <Identicon address={acc.address} size={32} />
                <div class="flex-1 min-w-0">
                  {editingIndex === i ? (
                    <div class="flex items-center gap-1">
                      <input
                        class="text-sm font-semibold text-text-primary bg-transparent outline-none w-full py-0 shadow-[0_1px_0_0_var(--color-accent)]"
                        value={editName}
                        onClick={(e) => e.stopPropagation()}
                        onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            walletState.renameAccount(i, editName.trim() || acc.name);
                            setEditingIndex(null);
                          }
                          if (e.key === "Escape") setEditingIndex(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          walletState.renameAccount(i, editName.trim() || acc.name);
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
                          setEditingIndex(i);
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
                      {acc.address.slice(0, 6)}...{acc.address.slice(-4)}
                    </span>
                    <CopyButton text={acc.address} size={12} />
                  </div>
                  <p class="text-[10px] font-mono text-text-tertiary mt-1">{acc.path}</p>
                </div>
                {i === walletState.activeAccountIndex.value && (
                  <div class="w-2 h-2 rounded-full bg-accent shrink-0" />
                )}
              </button>
            ))}
            {addingAccount ? (
              <div class="px-4 py-3 space-y-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={addPassword}
                  onInput={(v) => { setAddPassword(v); setAddError(""); }}
                  error={addError || undefined}
                  autoFocus
                />
                <div class="flex gap-2">
                  <Button size="sm" onClick={handleAddAccount}>Add</Button>
                  <button
                    type="button"
                    onClick={() => { setAddingAccount(false); setAddPassword(""); setAddError(""); }}
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
            onClick={() => { showNetworkSelector.value = true; }}
            class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <ChainIcon chainId={network.chain.id} size={16} />
              <span class="text-sm text-text-primary">{network.chain.name}</span>
            </div>
            <ChevronRight size={16} class="text-text-tertiary" />
          </button>
        </Card>

        {/* API Keys */}
        <ApiKeysSection />

        {/* Data */}
        <ClearCacheRow />

        {/* Security */}
        <Card header="Security" padding={false}>
          <div class="divide-y divide-divider">
            <div class="flex items-center gap-2 px-4 py-3">
              {walletState.storageMode.value === "keychain" ? (
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
            <SettingsRow label="Export Private Key" onClick={() => route("/export-key", true)} />
            <SettingsRow label="Show Recovery Phrase" onClick={() => route("/show-phrase", true)} />
          </div>
        </Card>
      </div>

      {showNetworkSelector.value && <NetworkSelector />}
    </div>
  );
}

function ClearCacheRow() {
  const [cleared, setCleared] = useState(false);

  const handleClear = async () => {
    if (cleared) return;
    await sendMessage({ type: "CLEAR_ACTIVITY_CACHE" });
    walletState.activity.value = [];
    walletState.activitySource.value = null;
    walletState.activityHasMore.value = false;
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <Card header="Data" padding={false}>
      <button
        type="button"
        onClick={handleClear}
        class={`flex items-center gap-2 w-full px-4 py-3 transition-colors cursor-pointer text-left ${
          cleared ? "text-success" : "text-danger hover:bg-base/50"
        }`}
      >
        {cleared ? <Check size={16} /> : <Trash2 size={16} />}
        <span class="text-sm font-medium">
          {cleared ? "Activity Cache Cleared" : "Clear Activity Cache"}
        </span>
      </button>
    </Card>
  );
}

function ApiKeyRow({
  icon: Icon,
  label,
  currentKey,
  dashboardUrl,
  dashboardLabel,
  onSave,
  onRemove,
}: {
  icon: typeof Key;
  label: string;
  currentKey: string | null;
  dashboardUrl: string;
  dashboardLabel: string;
  onSave: (key: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const maskedKey = currentKey
    ? `${currentKey.slice(0, 4)}${"•".repeat(8)}`
    : "Not set";

  const handleSave = async () => {
    setSaving(true);
    await onSave(editValue.trim());
    setEditing(false);
    setSaving(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    await onRemove();
    setEditing(false);
    setEditValue("");
    setSaving(false);
  };

  if (editing) {
    return (
      <div class="px-4 py-3 space-y-2">
        <Input
          label={label}
          placeholder="Paste your API key"
          value={editValue}
          onInput={setEditValue}
          mono
          autoFocus
        />
        <a
          href={dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors"
        >
          {dashboardLabel}
          <ExternalLink size={10} />
        </a>
        <div class="flex gap-2">
          <Button size="sm" onClick={handleSave} loading={saving}>
            Save
          </Button>
          {currentKey && (
            <Button size="sm" variant="ghost" onClick={handleRemove} loading={saving}>
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
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setEditValue(currentKey ?? "");
        setEditing(true);
      }}
      class="flex items-center justify-between w-full px-4 py-3 cursor-pointer text-left hover:bg-base/50 transition-colors"
    >
      <div class="flex items-center gap-2">
        <Icon size={16} class="text-text-tertiary" />
        <div>
          <p class="text-sm text-text-primary">{label}</p>
          <p class="text-xs font-mono text-text-tertiary">{maskedKey}</p>
        </div>
      </div>
      <ChevronRight size={16} class="text-text-tertiary" />
    </button>
  );
}

function ApiKeysSection() {
  const [alchemyKey, setAlchemyKey] = useState<string | null>(null);
  const [etherscanKey, setEtherscanKey] = useState<string | null>(null);

  useEffect(() => {
    sendMessage({ type: "GET_RPC_PROVIDER_KEY" }).then((res) => {
      if (res.ok && res.data) {
        setAlchemyKey((res.data as { key: string | null }).key);
      }
    });
    sendMessage({ type: "GET_ETHERSCAN_KEY" }).then((res) => {
      if (res.ok && res.data) {
        setEtherscanKey((res.data as { key: string | null }).key);
      }
    });
  }, []);

  return (
    <Card header="API Keys" padding={false}>
      <div class="divide-y divide-divider">
        <ApiKeyRow
          icon={Zap}
          label="Alchemy RPC Key"
          currentKey={alchemyKey}
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
          currentKey={etherscanKey}
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
