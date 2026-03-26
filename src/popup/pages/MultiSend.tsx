import { isAddress, toErrorMessage } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { MultiSendEntry } from "@shared/types";
import { ChevronDown, Plus, Trash2 } from "lucide-solid";
import { batch, createMemo, createSignal, For, Show } from "solid-js";
import type { Address } from "viem";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChainIcon } from "../components/ChainIcon";
import { Header } from "../components/Header";
import { TokenImage } from "../components/TokenImage";
import { useNavigate } from "../router";
import { type Token, walletState } from "../store";
import { showError } from "../toast";

const isNative = (token: Token) => !token.address;

interface SendRow {
  id: number;
  to: string;
  amount: string;
  token: Token;
}

let nextId = 0;
function emptyRow(token: Token): SendRow {
  return { id: nextId++, to: "", amount: "", token };
}

export function MultiSend() {
  const navigate = useNavigate();

  const disperseSupported = createMemo(() => !!walletState.activeNetwork().disperseAddress);

  const defaultToken = () => walletState.tokens()[0] as Token;
  const [rows, setRows] = createSignal<SendRow[]>([
    emptyRow(defaultToken()),
    emptyRow(defaultToken()),
  ]);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [pickerRow, setPickerRow] = createSignal<number | null>(null);

  const allValid = createMemo(() => {
    const r = rows();
    if (r.length < 2) return false;
    return r.every(
      (row) => isAddress(row.to) && parseFloat(row.amount.replace(/,/g, "") || "0") > 0,
    );
  });

  const canSubmit = createMemo(() => allValid() && !submitting() && disperseSupported());

  function updateRow(id: number, patch: Partial<SendRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setError(null);
  }

  function removeRow(id: number) {
    setRows((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(defaultToken())]);
  }

  const handleReview = async () => {
    setError(null);
    const r = rows();

    for (const row of r) {
      if (!isAddress(row.to)) {
        setError(`Invalid address in row ${r.indexOf(row) + 1}`);
        return;
      }
      const amt = parseFloat(row.amount.replace(/,/g, "") || "0");
      if (amt <= 0) {
        setError(`Invalid amount in row ${r.indexOf(row) + 1}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const entries: MultiSendEntry[] = r.map((row) => ({
        to: row.to as Address,
        tokenAddress: row.token.address as Address | undefined,
        amount: row.amount.replace(/,/g, ""),
        decimals: row.token.decimals,
        symbol: row.token.symbol,
        tokenName: row.token.name,
      }));

      const res = await sendMessage({ type: "MULTI_SEND", entries });
      if (!res.ok) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      navigate("/approve", { replace: true });
    } catch (e) {
      const detail = toErrorMessage(e);
      setError("Could not prepare multi-send");
      showError("Could not prepare multi-send", detail);
      setSubmitting(false);
    }
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Multi Send" onBack="/home" />

      <Show
        when={disperseSupported()}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
            <div class="flex items-center gap-2">
              <ChainIcon chainId={walletState.activeNetwork().id} size={24} />
              <span class="text-sm font-medium text-text-primary">
                {walletState.activeNetwork().name}
              </span>
            </div>
            <Banner variant="warning">
              Multi-send is not available on this network. The Disperse contract is not deployed
              here.
            </Banner>
            <Button
              variant="secondary"
              size="sm"
              fullWidth={false}
              onClick={() => navigate("/home", { replace: true })}
            >
              Back to Wallet
            </Button>
          </div>
        }
      >
        <div class="flex-1 px-4 pt-3 space-y-3 overflow-y-auto pb-2">
          <For each={rows()}>
            {(row, idx) => (
              <Card class="!p-3 relative">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-text-secondary">#{idx() + 1}</span>
                  <Show when={rows().length > 2}>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      class="text-text-tertiary hover:text-danger transition-colors cursor-pointer p-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Show>
                </div>

                {/* Token selector */}
                <button
                  type="button"
                  onClick={() => setPickerRow(pickerRow() === row.id ? null : row.id)}
                  class="w-full flex items-center justify-between px-2.5 py-1.5 bg-base rounded-lg ring-1 ring-transparent hover:ring-accent/30 transition-shadow cursor-pointer mb-2"
                >
                  <div class="flex items-center gap-2">
                    <Show
                      when={isNative(row.token)}
                      fallback={
                        <TokenImage
                          address={row.token.address}
                          chainId={walletState.activeNetwork().id}
                          symbol={row.token.symbol}
                          color={row.token.color}
                          size={20}
                        />
                      }
                    >
                      <ChainIcon chainId={walletState.activeNetwork().id} size={20} />
                    </Show>
                    <span class="text-xs font-medium text-text-primary">{row.token.symbol}</span>
                  </div>
                  <ChevronDown
                    size={14}
                    class={`text-text-tertiary transition-transform ${pickerRow() === row.id ? "rotate-180" : ""}`}
                  />
                </button>

                <Show when={pickerRow() === row.id}>
                  <div class="bg-base rounded-lg ring-1 ring-divider mb-2 max-h-[120px] overflow-y-auto">
                    <For each={walletState.tokens()}>
                      {(token) => (
                        <button
                          type="button"
                          onClick={() => {
                            batch(() => {
                              updateRow(row.id, { token, amount: "" });
                              setPickerRow(null);
                            });
                          }}
                          class={`w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-surface transition-colors cursor-pointer text-left ${
                            token.symbol === row.token.symbol ? "bg-accent-light" : ""
                          }`}
                        >
                          <Show
                            when={isNative(token)}
                            fallback={
                              <TokenImage
                                address={token.address}
                                chainId={walletState.activeNetwork().id}
                                symbol={token.symbol}
                                color={token.color}
                                size={18}
                              />
                            }
                          >
                            <ChainIcon chainId={walletState.activeNetwork().id} size={18} />
                          </Show>
                          <span class="text-xs font-medium text-text-primary">{token.symbol}</span>
                          <span class="ml-auto text-[10px] font-mono text-text-tertiary">
                            {token.balance}
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Recipient */}
                <input
                  class={`w-full bg-base rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-text-primary placeholder:text-text-tertiary outline-none ring-1 transition-shadow mb-2 ${
                    row.to.length > 0 && !isAddress(row.to)
                      ? "ring-danger"
                      : "ring-transparent focus:ring-accent/40 focus:ring-2"
                  }`}
                  type="text"
                  placeholder="Recipient 0x..."
                  value={row.to}
                  onInput={(e) => updateRow(row.id, { to: e.currentTarget.value })}
                />

                {/* Amount */}
                <div class="relative">
                  <input
                    class="w-full bg-base rounded-lg px-2.5 py-1.5 pr-14 text-sm font-mono text-text-primary placeholder:text-text-tertiary outline-none ring-1 ring-transparent focus:ring-accent/40 focus:ring-2 transition-shadow"
                    type="text"
                    placeholder="0.0"
                    value={row.amount}
                    onInput={(e) => updateRow(row.id, { amount: e.currentTarget.value })}
                  />
                  <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-text-secondary bg-surface px-1.5 py-0.5 rounded">
                    {row.token.symbol}
                  </span>
                </div>
              </Card>
            )}
          </For>

          <button
            type="button"
            onClick={addRow}
            class="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add recipient
          </button>

          <Show when={error()}>
            <Banner variant="danger">{error()}</Banner>
          </Show>
        </div>

        <div class="px-4 py-3">
          <Button onClick={handleReview} disabled={!canSubmit()} loading={submitting()} size="lg">
            Review {rows().length} Transactions
          </Button>
        </div>
      </Show>
    </div>
  );
}
