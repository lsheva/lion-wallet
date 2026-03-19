import { useState, useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";
import { route } from "preact-router";
import { ChevronDown, ChevronUp, Globe, Zap, Gauge, Rocket } from "lucide-preact";
import { formatEther, formatGwei, type Hex } from "viem";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { BottomActions } from "../components/BottomActions";
import { CopyButton } from "../components/CopyButton";
import { Spinner } from "../components/Spinner";
import { AddressDisplay } from "../components/AddressDisplay";
import { pendingApprovalData } from "../App";
import { sendMessage } from "@shared/messages";
import type { GasSpeed, GasPresets, PendingApproval, TransactionParams, SerializedAccount } from "@shared/types";
import { MOCK_TX_REQUEST } from "../mock/data";

const GAS_ICONS = { slow: Gauge, normal: Zap, fast: Rocket } as const;
const GAS_LABELS = { slow: "Slow", normal: "Normal", fast: "Fast" } as const;

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

function formatValue(hex: Hex | undefined): string {
  if (!hex || hex === "0x0" || hex === "0x") return "0";
  try {
    return formatEther(BigInt(hex));
  } catch {
    return "0";
  }
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface ApprovalData {
  approval: PendingApproval;
  gasPresets: GasPresets | null;
  account: SerializedAccount;
}

export function TxApproval() {
  const [data, setData] = useState<ApprovalData | null>(null);
  const [gasSpeed, setGasSpeed] = useState<GasSpeed>("normal");
  const [showDetails, setShowDetails] = useState(false);
  const [showData, setShowData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (isDev) {
      setLoading(false);
      return;
    }

    const cached = pendingApprovalData.value as ApprovalData | null;
    if (cached?.approval) {
      setData(cached);
      setLoading(false);
      return;
    }

    sendMessage({ type: "GET_PENDING_APPROVAL" }).then((res) => {
      if (res.ok && res.data) {
        setData(res.data as ApprovalData);
      }
      setLoading(false);
    });
  }, []);

  async function handleApprove() {
    if (isDev) {
      route("/tx-success");
      return;
    }
    if (!data) return;
    setSubmitting(true);
    const res = await sendMessage({
      type: "APPROVE_REQUEST",
      id: data.approval.id,
      gasSpeed,
    });
    pendingApprovalData.value = null;
    if (res.ok) {
      const result = (res.data as Record<string, unknown>)?.result;
      sessionStorage.setItem("txResult", JSON.stringify({ hash: result, method: data.approval.method }));
      route("/tx-success");
    } else {
      sessionStorage.setItem("txResult", JSON.stringify({ error: res.error }));
      route("/tx-error");
    }
  }

  async function handleReject() {
    if (isDev) {
      route("/home");
      return;
    }
    if (data) {
      await sendMessage({ type: "REJECT_REQUEST", id: data.approval.id });
      pendingApprovalData.value = null;
    }
    window.close();
  }

  if (loading) {
    return (
      <div class="flex items-center justify-center h-[600px]">
        <Spinner />
      </div>
    );
  }

  if (isDev) {
    return <DevTxApproval />;
  }

  if (!data) {
    return (
      <div class="flex flex-col items-center justify-center h-[600px] px-4 text-center">
        <p class="text-text-secondary text-sm">No pending transaction request.</p>
        <Button class="mt-4" onClick={() => route("/home")}>Back to Wallet</Button>
      </div>
    );
  }

  const { approval, gasPresets, account } = data;
  const txParams = approval.params[0] as TransactionParams;
  const value = formatValue(txParams.value);
  const hasValue = value !== "0";
  const currentGas = gasPresets?.[gasSpeed];

  return (
    <div class="flex flex-col h-[600px]">
      <div class="text-center py-3 border-b border-divider">
        <h1 class="text-base font-semibold text-text-primary">
          {approval.method === "eth_signTransaction" ? "Sign Transaction" : "Transaction Request"}
        </h1>
      </div>

      <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
        <Globe size={16} class="text-text-tertiary" />
        <span class="text-sm text-text-secondary">{approval.origin}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
        {/* Value transfer */}
        <Card>
          <div class="space-y-2.5">
            {hasValue && (
              <div class="flex items-center justify-between">
                <span class="text-sm text-text-secondary">Value</span>
                <span class="font-mono text-lg font-semibold text-text-primary">{value} ETH</span>
              </div>
            )}
            <div class="flex items-center justify-between">
              <span class="text-xs text-text-secondary">To</span>
              <AddressDisplay address={txParams.to} />
            </div>
            {account && (
              <div class="flex items-center justify-between">
                <span class="text-xs text-text-secondary">From</span>
                <AddressDisplay address={account.address} />
              </div>
            )}
          </div>
        </Card>

        {/* Gas speed selector */}
        {gasPresets && (
          <Card>
            <p class="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-2.5">Gas Fee</p>
            <div class="grid grid-cols-3 gap-2">
              {(["slow", "normal", "fast"] as GasSpeed[]).map((speed) => {
                const estimate = gasPresets[speed];
                const Icon = GAS_ICONS[speed];
                const active = gasSpeed === speed;
                return (
                  <button
                    type="button"
                    key={speed}
                    onClick={() => setGasSpeed(speed)}
                    class={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-[var(--radius-chip)] border transition-all cursor-pointer ${
                      active
                        ? "border-accent bg-accent-light"
                        : "border-divider hover:border-text-tertiary"
                    }`}
                  >
                    <Icon size={16} class={active ? "text-accent" : "text-text-tertiary"} />
                    <span class={`text-xs font-medium ${active ? "text-accent" : "text-text-secondary"}`}>
                      {GAS_LABELS[speed]}
                    </span>
                    <span class="font-mono text-[10px] text-text-tertiary">
                      {parseFloat(estimate.estimatedCostEth).toFixed(6)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Gas & Details */}
        <div ref={detailsRef}>
          <Card padding={false}>
            <button
              type="button"
              class="cursor-pointer w-full text-left"
              onClick={() => {
                const expanding = !showDetails;
                setShowDetails(expanding);
                if (expanding) scrollEndIntoView(detailsRef);
              }}
            >
              <div class="flex items-center justify-between px-4 py-2.5">
                <span class="text-xs text-text-secondary uppercase tracking-wider font-semibold">Details</span>
                {showDetails ? <ChevronUp size={14} class="text-text-tertiary" /> : <ChevronDown size={14} class="text-text-tertiary" />}
              </div>
              {currentGas && (
                <div class="px-4 pb-3">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-text-secondary">Estimated fee</span>
                    <span class="font-mono font-medium text-text-primary">
                      {parseFloat(currentGas.estimatedCostEth).toFixed(6)} ETH
                    </span>
                  </div>
                </div>
              )}
            </button>

            {showDetails && (
              <div class="px-4 pb-3 space-y-2 text-sm border-t border-divider pt-2.5">
                {currentGas && (
                  <>
                    <div class="flex justify-between">
                      <span class="text-text-secondary">Gas Limit</span>
                      <span class="font-mono text-text-primary">{currentGas.gasLimit}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-text-secondary">Max Fee</span>
                      <span class="font-mono text-text-primary">
                        {parseFloat(formatGwei(BigInt(currentGas.maxFeePerGas))).toFixed(2)} gwei
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-text-secondary">Priority Fee</span>
                      <span class="font-mono text-text-primary">
                        {parseFloat(formatGwei(BigInt(currentGas.maxPriorityFeePerGas))).toFixed(2)} gwei
                      </span>
                    </div>
                    {gasPresets && (
                      <div class="flex justify-between">
                        <span class="text-text-secondary">Base Fee</span>
                        <span class="font-mono text-text-primary">
                          {parseFloat(gasPresets.baseFeeGwei).toFixed(2)} gwei
                        </span>
                      </div>
                    )}
                  </>
                )}
                {txParams.data && txParams.data !== "0x" && (
                  <div ref={dataRef} class="border-t border-divider pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const expanding = !showData;
                        setShowData(expanding);
                        if (expanding) scrollEndIntoView(dataRef);
                      }}
                      class="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
                    >
                      <span>{showData ? "Hide" : "Show"} raw data</span>
                      {showData ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {showData && (
                      <div class="mt-2 relative">
                        <pre class="font-mono text-[10px] text-text-secondary bg-base rounded-[var(--radius-chip)] p-2 break-all whitespace-pre-wrap max-h-[80px] overflow-y-auto leading-relaxed">
                          {txParams.data}
                        </pre>
                        <div class="absolute top-1 right-1">
                          <CopyButton text={txParams.data} size={12} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      <BottomActions>
        <Button variant="secondary" onClick={handleReject} fullWidth disabled={submitting}>
          Reject
        </Button>
        <Button onClick={handleApprove} fullWidth loading={submitting}>
          Confirm
        </Button>
      </BottomActions>
    </div>
  );
}

function DevTxApproval() {
  const tx = MOCK_TX_REQUEST;
  const [showDetails, setShowDetails] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

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
        <Card>
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-sm text-text-secondary">Value</span>
              <span class="font-mono text-lg font-semibold text-text-primary">{tx.params.value}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-text-secondary">To</span>
              <span class="font-mono text-xs text-text-primary">{truncateAddress(tx.params.to)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <p class="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-2.5">Gas Fee</p>
          <div class="grid grid-cols-3 gap-2">
            {(["slow", "normal", "fast"] as GasSpeed[]).map((speed) => {
              const Icon = GAS_ICONS[speed];
              return (
                <button
                  type="button"
                  key={speed}
                  class={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-[var(--radius-chip)] border transition-all cursor-pointer ${
                    speed === "normal" ? "border-accent bg-accent-light" : "border-divider hover:border-text-tertiary"
                  }`}
                >
                  <Icon size={16} class={speed === "normal" ? "text-accent" : "text-text-tertiary"} />
                  <span class={`text-xs font-medium ${speed === "normal" ? "text-accent" : "text-text-secondary"}`}>
                    {GAS_LABELS[speed]}
                  </span>
                  <span class="font-mono text-[10px] text-text-tertiary">
                    {speed === "slow" ? "0.001200" : speed === "normal" ? "0.001440" : "0.001800"}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div ref={detailsRef}>
          <Card padding={false}>
            <button type="button" class="cursor-pointer w-full text-left" onClick={() => setShowDetails(!showDetails)}>
              <div class="flex items-center justify-between px-4 py-2.5">
                <span class="text-xs text-text-secondary uppercase tracking-wider font-semibold">Details</span>
                {showDetails ? <ChevronUp size={14} class="text-text-tertiary" /> : <ChevronDown size={14} class="text-text-tertiary" />}
              </div>
              <div class="px-4 pb-3">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-text-secondary">Estimated fee</span>
                  <span class="font-mono font-medium text-text-primary">{tx.estimatedFee}</span>
                </div>
              </div>
            </button>
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
