import { ArrowLeft, Check, Loader2, Plus, Search, Trash2 } from "lucide-solid";
import { batch, createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "../components/Button";
import { ChainIcon } from "../components/ChainIcon";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import {
  ALL_CHAINS,
  networks,
  setNetworks,
  setShowNetworkSelector,
  showNetworkSelector,
  walletState,
} from "../store";

type View = "select" | "add" | "custom";

async function fetchChainId(rpcUrl: string): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return parseInt(json.result, 16);
}

export function NetworkSelector() {
  const [view, setView] = createSignal<View>("select");
  const [search, setSearch] = createSignal("");
  const [addSearch, setAddSearch] = createSignal("");

  const [name, setName] = createSignal("");
  const [rpcUrl, setRpcUrl] = createSignal("");
  const [detectedChainId, setDetectedChainId] = createSignal<number | null>(null);
  const [detecting, setDetecting] = createSignal(false);
  const [symbol, setSymbol] = createSignal("ETH");
  const [error, setError] = createSignal("");

  const filtered = createMemo(() =>
    networks().filter((n) => n.name.toLowerCase().includes(search().toLowerCase())),
  );

  const addedIds = createMemo(() => new Set(networks().map((n) => n.id)));

  const availableChains = createMemo(() => {
    const ids = addedIds();
    const q = addSearch().toLowerCase();
    return ALL_CHAINS.filter((c) => !ids.has(c.id) && c.name.toLowerCase().includes(q));
  });

  let detectTimer: ReturnType<typeof setTimeout> | null = null;

  const handleDetectChain = (url: string) => {
    setRpcUrl(url);
    setError("");
    setDetectedChainId(null);

    if (detectTimer) clearTimeout(detectTimer);
    if (!url.trim().startsWith("http")) return;

    detectTimer = setTimeout(async () => {
      setDetecting(true);
      try {
        const id = await fetchChainId(url.trim());
        if (networks().some((n) => n.id === id)) {
          setError(`Chain ID ${id} already exists`);
          setDetectedChainId(null);
        } else {
          setDetectedChainId(id);
        }
      } catch {
        setError("Could not connect to RPC");
      } finally {
        setDetecting(false);
      }
    }, 300);
  };

  const handleAddCustom = () => {
    if (!name().trim()) {
      setError("Network name is required");
      return;
    }
    if (!rpcUrl().trim()) {
      setError("RPC URL is required");
      return;
    }
    const chainId = detectedChainId();
    if (!chainId) {
      setError("Enter a valid RPC URL to detect Chain ID");
      return;
    }
    if (!symbol().trim()) {
      setError("Currency symbol is required");
      return;
    }

    const sym = symbol().trim().toUpperCase();
    setNetworks([
      ...networks(),
      {
        id: chainId,
        name: name().trim(),
        nativeCurrency: { name: sym, symbol: sym, decimals: 18 },
        rpcUrl: rpcUrl().trim(),
      },
    ]);
    walletState.switchNetwork(chainId);
    setView("select");
    resetForm();
  };

  const handleAddChain = (chain: import("@shared/types").ChainMeta) => {
    setNetworks([...networks(), chain]);
  };

  const handleRemoveChain = (chainId: number) => {
    if (walletState.activeNetworkId() === chainId) return;
    setNetworks(networks().filter((n) => n.id !== chainId));
  };

  const resetForm = () => {
    batch(() => {
      setName("");
      setRpcUrl("");
      setDetectedChainId(null);
      setDetecting(false);
      setSymbol("");
      setError("");
    });
  };

  const closeModal = () => {
    setShowNetworkSelector(false);
    setView("select");
    setSearch("");
    setAddSearch("");
    resetForm();
  };

  const title = () => {
    const v = view();
    if (v === "add") return "Add Chain";
    if (v === "custom") return "Custom Network";
    return "Networks";
  };

  return (
    <Modal open={showNetworkSelector()} onClose={closeModal} title={title()}>
      <Show when={view() === "select"}>
        <div class="px-4 pt-3 pb-2">
          <Input placeholder="Search networks..." value={search()} onInput={setSearch} autoFocus />
        </div>

        <NetworkGroup
          networks={filtered().filter((n) => !n.testnet)}
          activeId={walletState.activeNetworkId()}
          onSelect={(id) => walletState.switchNetwork(id)}
          onRemove={handleRemoveChain}
          removable
        />
        <Show when={filtered().some((n) => n.testnet)}>
          <div class="px-4 pt-3 pb-1">
            <span class="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
              Testnets
            </span>
          </div>
          <NetworkGroup
            networks={filtered().filter((n) => n.testnet)}
            activeId={walletState.activeNetworkId()}
            onSelect={(id) => walletState.switchNetwork(id)}
            onRemove={handleRemoveChain}
            removable
          />
        </Show>

        <button
          type="button"
          onClick={() => setView("add")}
          class="flex items-center gap-2 w-full px-4 py-3 text-accent hover:bg-base/50 transition-colors cursor-pointer border-t border-divider"
        >
          <Plus size={16} />
          <span class="text-sm font-medium">Add Chain</span>
        </button>
      </Show>

      <Show when={view() === "add"}>
        <div class="px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={() => {
              setView("select");
              setAddSearch("");
            }}
            class="flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition-colors cursor-pointer mb-2"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div class="relative">
            <Search
              size={14}
              class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search all chains..."
              value={addSearch()}
              onInput={(e) => setAddSearch(e.currentTarget.value)}
              class="w-full h-10 pl-8 pr-3 bg-surface text-sm text-text-primary rounded-[var(--radius-card)] ring-1 ring-divider focus:ring-accent focus:outline-none placeholder:text-text-tertiary"
              autofocus
            />
          </div>
        </div>

        <div class="max-h-[300px] overflow-y-auto">
          <Show
            when={availableChains().length > 0}
            fallback={
              <div class="px-4 py-6 text-center text-sm text-text-tertiary">No chains found</div>
            }
          >
            <div class="px-4 pt-2 pb-1">
              <Show when={availableChains().some((c) => !c.testnet)}>
                <span class="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                  Mainnets
                </span>
              </Show>
            </div>
            <div class="divide-y divide-divider">
              <For each={availableChains().filter((c) => !c.testnet)}>
                {(chain) => (
                  <div class="flex items-center gap-3 w-full px-4 py-2.5">
                    <ChainIcon chainId={chain.id} size={20} />
                    <span class="flex-1 text-sm text-text-primary truncate">{chain.name}</span>
                    <button
                      type="button"
                      onClick={() => handleAddChain(chain)}
                      class="shrink-0 px-2.5 py-1 text-xs font-medium text-accent bg-accent/10 rounded-full hover:bg-accent/20 transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}
              </For>
            </div>
            <Show when={availableChains().some((c) => c.testnet)}>
              <div class="px-4 pt-3 pb-1">
                <span class="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                  Testnets
                </span>
              </div>
              <div class="divide-y divide-divider">
                <For each={availableChains().filter((c) => c.testnet)}>
                  {(chain) => (
                    <div class="flex items-center gap-3 w-full px-4 py-2.5 opacity-80">
                      <ChainIcon chainId={chain.id} size={20} />
                      <span class="flex-1 text-sm text-text-secondary truncate">{chain.name}</span>
                      <button
                        type="button"
                        onClick={() => handleAddChain(chain)}
                        class="shrink-0 px-2.5 py-1 text-xs font-medium text-accent bg-accent/10 rounded-full hover:bg-accent/20 transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        <button
          type="button"
          onClick={() => setView("custom")}
          class="flex items-center gap-2 w-full px-4 py-3 text-text-secondary hover:bg-base/50 transition-colors cursor-pointer border-t border-divider"
        >
          <Plus size={16} />
          <span class="text-sm font-medium">Add Custom Network</span>
        </button>
      </Show>

      <Show when={view() === "custom"}>
        <div class="px-4 py-3 space-y-3">
          <button
            type="button"
            onClick={() => {
              setView("add");
              resetForm();
            }}
            class="flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <Input
            label="Network Name"
            placeholder="e.g. Polygon zkEVM"
            value={name()}
            onInput={(v) => {
              setName(v);
              setError("");
            }}
            autoFocus
          />
          <Input
            label="RPC URL"
            placeholder="https://..."
            value={rpcUrl()}
            onInput={handleDetectChain}
            mono
          />
          <div class="space-y-1.5">
            <span class="block text-sm font-medium text-text-secondary">Chain ID</span>
            <div class="flex items-center h-10 px-3 bg-surface rounded-[var(--radius-card)] ring-1 ring-transparent">
              <Show
                when={detecting()}
                fallback={
                  <Show
                    when={detectedChainId()}
                    fallback={
                      <span class="text-sm text-text-tertiary">Auto-detected from RPC</span>
                    }
                  >
                    <span class="font-mono text-sm text-text-primary">{detectedChainId()}</span>
                  </Show>
                }
              >
                <span class="flex items-center gap-2 text-sm text-text-tertiary">
                  <Loader2 size={14} class="animate-spin text-accent" />
                  Detecting...
                </span>
              </Show>
            </div>
          </div>
          <Input
            label="Currency Symbol"
            placeholder="e.g. ETH"
            value={symbol()}
            onInput={(v) => {
              setSymbol(v);
              setError("");
            }}
          />

          <Show when={error()}>
            <p class="text-xs text-danger">{error()}</p>
          </Show>

          <div class="pt-1">
            <Button onClick={handleAddCustom} size="md">
              Add Network
            </Button>
          </div>
        </div>
      </Show>
    </Modal>
  );
}

function NetworkGroup(props: {
  networks: import("@shared/types").ChainMeta[];
  activeId: number;
  onSelect: (id: number) => void;
  onRemove?: (id: number) => void;
  removable?: boolean;
}) {
  return (
    <div class="divide-y divide-divider">
      <For each={props.networks}>
        {(network) => {
          const isActive = () => network.id === props.activeId;
          const isTestnet = !!network.testnet;
          return (
            <div class="flex items-center group">
              <button
                type="button"
                onClick={() => props.onSelect(network.id)}
                class={`flex items-center gap-3 flex-1 min-w-0 px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left ${isTestnet ? "opacity-80" : ""}`}
              >
                <ChainIcon chainId={network.id} size={20} />
                <span
                  class={`flex-1 text-sm truncate ${isTestnet ? "text-text-secondary" : "text-text-primary"}`}
                >
                  {network.name}
                </span>
                {isActive() && <Check size={16} class="text-accent shrink-0" />}
              </button>
              <Show when={props.removable && !isActive()}>
                <button
                  type="button"
                  onClick={() => props.onRemove?.(network.id)}
                  class="px-3 py-3 text-text-tertiary hover:text-danger transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Remove network"
                >
                  <Trash2 size={14} />
                </button>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
