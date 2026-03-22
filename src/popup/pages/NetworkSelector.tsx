import { ArrowLeft, Check, Loader2, Plus } from "lucide-solid";
import { batch, createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "../components/Button";
import { ChainIcon } from "../components/ChainIcon";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import {
  networks,
  setNetworks,
  setShowNetworkSelector,
  showNetworkSelector,
  walletState,
} from "../store";

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
  const [search, setSearch] = createSignal("");
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [name, setName] = createSignal("");
  const [rpcUrl, setRpcUrl] = createSignal("");
  const [detectedChainId, setDetectedChainId] = createSignal<number | null>(null);
  const [detecting, setDetecting] = createSignal(false);
  const [symbol, setSymbol] = createSignal("ETH");
  const [error, setError] = createSignal("");

  const filtered = createMemo(() =>
    networks().filter((n) => n.name.toLowerCase().includes(search().toLowerCase())),
  );

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

  const handleAdd = () => {
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
    setShowAddForm(false);
    resetForm();
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

  return (
    <Modal
      open={showNetworkSelector()}
      onClose={() => {
        setShowNetworkSelector(false);
        setShowAddForm(false);
        resetForm();
      }}
      title={showAddForm() ? "Add Network" : "Select Network"}
    >
      <Show
        when={showAddForm()}
        fallback={
          <>
            <div class="px-4 pt-3 pb-2">
              <Input
                placeholder="Search networks..."
                value={search()}
                onInput={setSearch}
                autoFocus
              />
            </div>

            <NetworkGroup
              networks={filtered().filter((n) => !n.testnet)}
              activeId={walletState.activeNetworkId()}
              onSelect={(id) => walletState.switchNetwork(id)}
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
              />
            </Show>

            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              class="flex items-center gap-2 w-full px-4 py-3 text-accent hover:bg-base/50 transition-colors cursor-pointer border-t border-divider"
            >
              <Plus size={16} />
              <span class="text-sm font-medium">Add Custom Network</span>
            </button>
          </>
        }
      >
        <div class="px-4 py-3 space-y-3">
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              resetForm();
            }}
            class="flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft size={14} />
            Back to networks
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
            <Button onClick={handleAdd} size="md">
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
}) {
  return (
    <div class="divide-y divide-divider">
      <For each={props.networks}>
        {(network) => {
          const isActive = () => network.id === props.activeId;
          const isTestnet = !!network.testnet;
          return (
            <button
              type="button"
              onClick={() => props.onSelect(network.id)}
              class={`flex items-center gap-3 w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left ${isTestnet ? "opacity-80" : ""}`}
            >
              <ChainIcon chainId={network.id} size={20} />
              <span
                class={`flex-1 text-sm ${isTestnet ? "text-text-secondary" : "text-text-primary"}`}
              >
                {network.name}
              </span>
              {isActive() && <Check size={16} class="text-accent shrink-0" />}
            </button>
          );
        }}
      </For>
    </div>
  );
}
