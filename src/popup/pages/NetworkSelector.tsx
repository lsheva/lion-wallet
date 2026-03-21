import { ArrowLeft, Check, Loader2, Plus } from "lucide-preact";
import { useCallback, useRef, useState } from "preact/hooks";
import { Button } from "../components/Button";
import { ChainIcon } from "../components/ChainIcon";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { networks, showNetworkSelector, walletState } from "../store";

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
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [detectedChainId, setDetectedChainId] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [symbol, setSymbol] = useState("ETH");
  const [error, setError] = useState("");

  const filtered = networks.value.filter((n) =>
    n.name.toLowerCase().includes(search.toLowerCase()),
  );

  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDetectChain = useCallback((url: string) => {
    setRpcUrl(url);
    setError("");
    setDetectedChainId(null);

    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    if (!url.trim().startsWith("http")) return;

    detectTimerRef.current = setTimeout(async () => {
      setDetecting(true);
      try {
        const id = await fetchChainId(url.trim());
        if (networks.value.some((n) => n.id === id)) {
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
  }, []);

  const handleAdd = () => {
    if (!name.trim()) {
      setError("Network name is required");
      return;
    }
    if (!rpcUrl.trim()) {
      setError("RPC URL is required");
      return;
    }
    if (!detectedChainId) {
      setError("Enter a valid RPC URL to detect Chain ID");
      return;
    }
    if (!symbol.trim()) {
      setError("Currency symbol is required");
      return;
    }

    const sym = symbol.trim().toUpperCase();
    networks.value = [
      ...networks.value,
      {
        id: detectedChainId,
        name: name.trim(),
        nativeCurrency: { name: sym, symbol: sym, decimals: 18 },
        rpcUrl: rpcUrl.trim(),
      },
    ];
    walletState.switchNetwork(detectedChainId);
    setShowAddForm(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setRpcUrl("");
    setDetectedChainId(null);
    setDetecting(false);
    setSymbol("");
    setError("");
  };

  return (
    <Modal
      open={showNetworkSelector.value}
      onClose={() => {
        showNetworkSelector.value = false;
        setShowAddForm(false);
        resetForm();
      }}
      title={showAddForm ? "Add Network" : "Select Network"}
    >
      {showAddForm ? (
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
            value={name}
            onInput={(v) => {
              setName(v);
              setError("");
            }}
            autoFocus
          />
          <Input
            label="RPC URL"
            placeholder="https://..."
            value={rpcUrl}
            onInput={handleDetectChain}
            mono
          />
          <div class="space-y-1.5">
            <span class="block text-sm font-medium text-text-secondary">Chain ID</span>
            <div class="flex items-center h-10 px-3 bg-surface rounded-[var(--radius-card)] ring-1 ring-transparent">
              {detecting ? (
                <span class="flex items-center gap-2 text-sm text-text-tertiary">
                  <Loader2 size={14} class="animate-spin text-accent" />
                  Detecting...
                </span>
              ) : detectedChainId ? (
                <span class="font-mono text-sm text-text-primary">{detectedChainId}</span>
              ) : (
                <span class="text-sm text-text-tertiary">Auto-detected from RPC</span>
              )}
            </div>
          </div>
          <Input
            label="Currency Symbol"
            placeholder="e.g. ETH"
            value={symbol}
            onInput={(v) => {
              setSymbol(v);
              setError("");
            }}
          />

          {error && <p class="text-xs text-danger">{error}</p>}

          <div class="pt-1">
            <Button onClick={handleAdd} size="md">
              Add Network
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div class="px-4 pt-3 pb-2">
            <Input placeholder="Search networks..." value={search} onInput={setSearch} autoFocus />
          </div>

          <NetworkGroup
            networks={filtered.filter((n) => !n.testnet)}
            activeId={walletState.activeNetworkId.value}
            onSelect={(id) => walletState.switchNetwork(id)}
          />
          {filtered.some((n) => n.testnet) && (
            <>
              <div class="px-4 pt-3 pb-1">
                <span class="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                  Testnets
                </span>
              </div>
              <NetworkGroup
                networks={filtered.filter((n) => n.testnet)}
                activeId={walletState.activeNetworkId.value}
                onSelect={(id) => walletState.switchNetwork(id)}
              />
            </>
          )}

          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            class="flex items-center gap-2 w-full px-4 py-3 text-accent hover:bg-base/50 transition-colors cursor-pointer border-t border-divider"
          >
            <Plus size={16} />
            <span class="text-sm font-medium">Add Custom Network</span>
          </button>
        </>
      )}
    </Modal>
  );
}

function NetworkGroup({
  networks: nets,
  activeId,
  onSelect,
}: {
  networks: import("@shared/types").ChainMeta[];
  activeId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div class="divide-y divide-divider">
      {nets.map((network) => {
        const isActive = network.id === activeId;
        const isTestnet = !!network.testnet;
        return (
          <button
            type="button"
            key={network.id}
            onClick={() => onSelect(network.id)}
            class={`flex items-center gap-3 w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left ${isTestnet ? "opacity-80" : ""}`}
          >
            <ChainIcon chainId={network.id} size={20} />
            <span
              class={`flex-1 text-sm ${isTestnet ? "text-text-secondary" : "text-text-primary"}`}
            >
              {network.name}
            </span>
            {isActive && <Check size={16} class="text-accent shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
