import { useState, useRef, type RefObject } from "preact/hooks";
import { route } from "preact-router";
import { ChevronDown, ChevronUp, Globe, FileCode, ArrowUpRight, ArrowDownLeft } from "lucide-preact";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { BottomActions } from "../components/BottomActions";
import { CopyButton } from "../components/CopyButton";
import { MOCK_TX_REQUEST } from "../mock/data";

function formatArgValue(value: string, type: string): string {
  if (type === "address") return `${value.slice(0, 6)}...${value.slice(-4)}`;
  if (value.length > 12) return `${value.slice(0, 8)}...${value.slice(-4)}`;
  return value;
}

const COLLAPSED_ARGS = 3;

function scrollEndIntoView(ref: RefObject<HTMLElement | null>) {
  requestAnimationFrame(() => {
    const el = ref.current;
    if (!el) return;
    const container = el.closest(".overflow-y-auto");
    if (!container) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const elBottom = elRect.bottom - containerRect.top + container.scrollTop;
    const target = elBottom - container.clientHeight + 8;
    if (target > container.scrollTop) {
      container.scrollTo({ top: target, behavior: "smooth" });
    }
  });
}

export function TxApproval() {
  const [showDetails, setShowDetails] = useState(false);
  const [showData, setShowData] = useState(false);
  const [argsExpanded, setArgsExpanded] = useState(false);
  const argsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const tx = MOCK_TX_REQUEST;
  const decoded = tx.decoded;

  return (
    <div class="flex flex-col h-[600px]">
      <div class="text-center py-3 border-b border-divider">
        <h1 class="text-base font-semibold text-text-primary">Transaction Request</h1>
      </div>

      <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
        <Globe size={16} class="text-text-tertiary" />
        <span class="text-sm text-text-secondary">{tx.origin}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
        {/* Decoded contract call */}
        {decoded && (
          <Card>
            <div class="space-y-2.5">
              <div class="flex items-center gap-2">
                <FileCode size={16} class="text-accent shrink-0" />
                <div class="min-w-0">
                  {decoded.contractName && (
                    <p class="text-xs text-text-tertiary">{decoded.contractName}</p>
                  )}
                  <p class="font-mono text-sm font-semibold text-accent truncate">
                    {decoded.functionName}()
                  </p>
                </div>
              </div>

              <div
                ref={argsRef}
                class="bg-base rounded-[var(--radius-chip)] divide-y divide-divider cursor-pointer"
                onClick={() => { const expanding = !argsExpanded; setArgsExpanded(expanding); if (expanding) scrollEndIntoView(argsRef); }}
              >
                {(argsExpanded ? decoded.args : decoded.args.slice(0, COLLAPSED_ARGS)).map((arg) => (
                  <div key={arg.name} class="flex items-center justify-between px-3 py-2">
                    <span class="text-xs text-text-secondary shrink-0">{arg.name}</span>
                    <span class="font-mono text-xs text-text-primary text-right">
                      {formatArgValue(arg.value, arg.type)}
                    </span>
                  </div>
                ))}
                {decoded.args.length > COLLAPSED_ARGS && (
                  <div class="flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] text-accent">
                    {argsExpanded ? (
                      <><ChevronUp size={12} /> Show less</>
                    ) : (
                      <><ChevronDown size={12} /> {decoded.args.length - COLLAPSED_ARGS} more</>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Token transfers */}
        <Card>
          <div class="space-y-1">
            <p class="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-2">Token Transfers</p>
            <div class="divide-y divide-divider">
              {tx.transfers.map((t) => (
                <div key={`${t.direction}-${t.symbol}`} class="flex items-center gap-2.5 py-2">
                  <div class="relative">
                    <div
                      class="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.symbol.slice(0, 1)}
                    </div>
                    <div class={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${t.direction === "out" ? "bg-danger" : "bg-success"}`}>
                      {t.direction === "out"
                        ? <ArrowUpRight size={9} class="text-white" />
                        : <ArrowDownLeft size={9} class="text-white" />}
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-primary">
                      {t.direction === "out" ? "Send" : "Receive"} {t.symbol}
                    </p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class={`font-mono text-sm font-medium ${t.direction === "out" ? "text-danger" : "text-success"}`}>
                      {t.direction === "out" ? "-" : "+"}{t.amount}
                    </p>
                    <p class="text-xs text-text-secondary">{t.usdValue}</p>
                  </div>
                </div>
              ))}
            </div>
            {tx.transfers.length > 1 && (
              <div class="flex items-center justify-between pt-2 border-t border-divider">
                <span class="text-xs text-text-secondary">Total value</span>
                <span class="font-mono text-sm font-semibold text-text-primary">{tx.totalUsd}</span>
              </div>
            )}
            <div class="flex items-center justify-between pt-1.5">
              <span class="text-xs text-text-secondary">Interacting with</span>
              <span class="font-mono text-xs text-text-primary">{tx.params.to.slice(0, 6)}...{tx.params.to.slice(-4)}</span>
            </div>
          </div>
        </Card>

        {/* Gas & Details */}
        <div ref={detailsRef}>
          <Card padding={false}>
            <div
              class="cursor-pointer"
              onClick={() => { const expanding = !showDetails; setShowDetails(expanding); if (expanding) scrollEndIntoView(detailsRef); }}
            >
              <div class="flex items-center justify-between px-4 py-2.5">
                <span class="text-xs text-text-secondary uppercase tracking-wider font-semibold">Gas & Details</span>
                {showDetails ? <ChevronUp size={14} class="text-text-tertiary" /> : <ChevronDown size={14} class="text-text-tertiary" />}
              </div>
              <div class="px-4 pb-3">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-text-secondary">Estimated fee</span>
                  <span class="font-mono font-medium text-text-primary">{tx.estimatedFee}</span>
                </div>
              </div>
            </div>

            {showDetails && (
              <div class="px-4 pb-3 space-y-2 text-sm border-t border-divider pt-2.5">
                <div class="flex justify-between">
                  <span class="text-text-secondary">Gas Limit</span>
                  <span class="font-mono text-text-primary">{tx.params.gasLimit}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">Max Fee</span>
                  <span class="font-mono text-text-primary">{tx.params.maxFee}</span>
                </div>
                <div ref={dataRef} class="border-t border-divider pt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); const expanding = !showData; setShowData(expanding); if (expanding) scrollEndIntoView(dataRef); }}
                    class="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
                  >
                    <span>{showData ? "Hide" : "Show"} raw data</span>
                    {showData ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showData && (
                    <div class="mt-2 relative">
                      <pre class="font-mono text-[10px] text-text-secondary bg-base rounded-[var(--radius-chip)] p-2 break-all whitespace-pre-wrap max-h-[80px] overflow-y-auto leading-relaxed">
                        {tx.params.data}
                      </pre>
                      <div class="absolute top-1 right-1">
                        <CopyButton text={tx.params.data} size={12} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <BottomActions>
        <Button variant="secondary" onClick={() => route("/home")} fullWidth>
          Reject
        </Button>
        <Button onClick={() => route("/tx-success")} fullWidth>
          Confirm
        </Button>
      </BottomActions>
    </div>
  );
}
