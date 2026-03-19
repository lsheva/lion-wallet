import { useState } from "preact/hooks";
import { Check, Plus, ArrowLeft, Loader2 } from "lucide-preact";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { walletState, showNetworkSelector, networks } from "../store";

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
    n.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDetectChain = async (url: string) => {
    setRpcUrl(url);
    setError("");
    setDetectedChainId(null);

    if (!url.trim().startsWith("http")) return;

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
  };

  const handleAdd = () => {
    if (!name.trim()) { setError("Network name is required"); return; }
    if (!rpcUrl.trim()) { setError("RPC URL is required"); return; }
    if (!detectedChainId) { setError("Enter a valid RPC URL to detect Chain ID"); return; }
    if (!symbol.trim()) { setError("Currency symbol is required"); return; }

    networks.value = [
      ...networks.value,
      { id: detectedChainId, name: name.trim(), symbol: symbol.trim().toUpperCase(), color: "#8E8E93", rpcUrl: rpcUrl.trim() },
    ];
    walletState.switchNetwork(detectedChainId);
    setShowAddForm(false);
    resetForm();
  };

  const resetForm = () => {
    setName(""); setRpcUrl(""); setDetectedChainId(null); setDetecting(false); setSymbol(""); setError("");
  };

  return (
    <Modal
      open={showNetworkSelector.value}
      onClose={() => { showNetworkSelector.value = false; setShowAddForm(false); resetForm(); }}
      title={showAddForm ? "Add Network" : "Select Network"}
    >
      {showAddForm ? (
        <div class="px-4 py-3 space-y-3">
          <button
            onClick={() => { setShowAddForm(false); resetForm(); }}
            class="flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft size={14} />
            Back to networks
          </button>

          <Input
            label="Network Name"
            placeholder="e.g. Polygon zkEVM"
            value={name}
            onInput={(v) => { setName(v); setError(""); }}
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
            <label class="block text-sm font-medium text-text-secondary">Chain ID</label>
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
            onInput={(v) => { setSymbol(v); setError(""); }}
          />

          {error && <p class="text-xs text-danger">{error}</p>}

          <div class="pt-1">
            <Button onClick={handleAdd} size="md">Add Network</Button>
          </div>
        </div>
      ) : (
        <>
          <div class="px-4 pt-3 pb-2">
            <Input
              placeholder="Search networks..."
              value={search}
              onInput={setSearch}
              autoFocus
            />
          </div>

          <div class="divide-y divide-divider">
            {filtered.map((network) => {
              const isActive = network.id === walletState.activeNetworkId.value;
              return (
                <button
                  key={network.id}
                  onClick={() => walletState.switchNetwork(network.id)}
                  class="flex items-center gap-3 w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left"
                >
                  <span
                    class="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: network.color }}
                  />
                  <span class="flex-1 text-sm text-text-primary">
                    {network.name}
                    {network.testnet && (
                      <span class="ml-1.5 text-xs text-text-tertiary">(testnet)</span>
                    )}
                  </span>
                  {isActive && <Check size={16} class="text-accent shrink-0" />}
                </button>
              );
            })}
          </div>

          <button
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
