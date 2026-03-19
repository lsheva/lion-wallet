import { useState } from "preact/hooks";
import { route } from "preact-router";
import { ChevronRight, Plus, Lock, Pencil, Check } from "lucide-preact";
import { Header } from "../components/Header";
import { Card } from "../components/Card";
import { Identicon } from "../components/Identicon";
import { CopyButton } from "../components/CopyButton";
import { Button } from "../components/Button";
import { walletState, showNetworkSelector } from "../mock/state";
import { NetworkSelector } from "./NetworkSelector";

function SettingsRow({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
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

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Settings" onBack="/home" />

      <div class="flex-1 overflow-y-auto px-4 pt-2 space-y-4 pb-4">
        {/* Accounts */}
        <Card header="Accounts" padding={false}>
          <div class="divide-y divide-divider">
            {accounts.map((acc, i) => (
              <button
                key={acc.address}
                onClick={() => walletState.switchAccount(i)}
                class={`flex items-center gap-3 w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left
                  ${i === walletState.activeAccountIndex.value ? "bg-accent-light" : ""}`}
              >
                <Identicon address={acc.address} size={32} />
                <div class="flex-1 min-w-0">
                  {editingIndex === i ? (
                    <div class="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        class="text-sm font-semibold text-text-primary bg-transparent outline-none w-full py-0 shadow-[0_1px_0_0_var(--color-accent)]"
                        value={editName}
                        onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            walletState.renameAccount(i, editName.trim() || acc.name);
                            setEditingIndex(null);
                          }
                          if (e.key === "Escape") setEditingIndex(null);
                        }}
                        autoFocus
                      />
                      <button
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
            <button class="flex items-center gap-2 w-full px-4 py-3 text-accent hover:bg-base/50 transition-colors cursor-pointer">
              <Plus size={16} />
              <span class="text-sm font-medium">Add Account</span>
            </button>
          </div>
        </Card>

        {/* Network */}
        <Card header="Network" padding={false}>
          <button
            onClick={() => (showNetworkSelector.value = true)}
            class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: network.color }} />
              <span class="text-sm text-text-primary">{network.name}</span>
            </div>
            <ChevronRight size={16} class="text-text-tertiary" />
          </button>
        </Card>

        {/* Security */}
        <Card header="Security" padding={false}>
          <div class="divide-y divide-divider">
            <SettingsRow label="Auto-lock timer" onClick={() => route("/auto-lock")} />
            <SettingsRow label="Export Private Key" onClick={() => route("/export-key")} />
            <SettingsRow label="Show Recovery Phrase" onClick={() => route("/show-phrase")} />
          </div>
        </Card>

        <Button
          variant="ghost"
          onClick={() => {
            walletState.lock();
            route("/unlock");
          }}
        >
          <Lock size={16} />
          Lock Wallet
        </Button>
      </div>

      {showNetworkSelector.value && <NetworkSelector />}
    </div>
  );
}
