import { useState, useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";
import { route } from "preact-router";
import { ChevronDown, ChevronUp, Globe, Zap, Gauge, Rocket, FileCode, ArrowUpRight, ArrowDownLeft } from "lucide-preact";
import { formatEther, formatGwei, type Hex } from "viem";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { BottomActions } from "../components/BottomActions";
import { CopyButton } from "../components/CopyButton";
import { Spinner } from "../components/Spinner";
import { Identicon } from "../components/Identicon";
import { AddressDisplay } from "../components/AddressDisplay";
import { pendingApprovalData, routeToNextApprovalOrClose, closePopup } from "../App";
import { sendMessage } from "@shared/messages";
import type { GasSpeed, GasPresets, PendingApproval, TransactionParams, SerializedAccount } from "@shared/types";
import { POPUP_ORIGIN } from "@shared/constants";
import { MOCK_TX_REQUEST, MOCK_SIGN_REQUEST } from "../mock/data";
import { walletState } from "../store";

const TX_METHODS = new Set(["eth_sendTransaction", "eth_signTransaction"]);

interface ApprovalData {
  approval: PendingApproval;
  gasPresets: GasPresets | null;
  account: SerializedAccount;
  queueSize?: number;
}

export function Approve() {
  const [data, setData] = useState<ApprovalData | null>(null);
  const [gasSpeed, setGasSpeed] = useState<GasSpeed>("normal");
  const [showDetails, setShowDetails] = useState(false);
  const [showData, setShowData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (isDev) {
      setLoading(false);
      return;
    }

    const cached = pendingApprovalData.value as ApprovalData | null;
    if (cached?.approval) {
      setData(cached);
      setGasSpeed("normal");
      setShowDetails(false);
      setShowData(false);
      setSubmitting(false);
      setLoading(false);
      return;
    }

    sendMessage({ type: "GET_PENDING_APPROVAL" }).then((res) => {
      if (res.ok && res.data) {
        setData(res.data as ApprovalData);
      }
      setLoading(false);
    });
  }, [pendingApprovalData.value]);

  const isTx = data ? TX_METHODS.has(data.approval.method) : false;
  const isPopupOrigin = data?.approval.origin === POPUP_ORIGIN;

  async function handleConfirm() {
    if (isDev) {
      route(isTx ? "/tx-success" : "/sign-success");
      return;
    }
    if (!data) return;
    setSubmitting(true);
    const res = await sendMessage({
      type: "APPROVE_REQUEST",
      id: data.approval.id,
      ...(isTx ? { gasSpeed } : {}),
    });
    pendingApprovalData.value = null;
    if (res.ok) {
      const result = (res.data as Record<string, unknown>)?.result;
      if (isTx) {
        sessionStorage.setItem("txResult", JSON.stringify({ hash: result, method: data.approval.method }));
      } else {
        sessionStorage.setItem("signResult", JSON.stringify({ signature: result }));
      }
      const fallbackRoute = isTx ? "/tx-success" : "/sign-success";
      await routeToNextApprovalOrClose(() => route(fallbackRoute));
    } else {
      if (isTx) {
        sessionStorage.setItem("txResult", JSON.stringify({ error: res.error }));
        route("/tx-error");
      } else {
        sessionStorage.setItem("signResult", JSON.stringify({ error: res.error }));
        route("/sign-error");
      }
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
    await routeToNextApprovalOrClose(() => {
      if (isPopupOrigin) {
        route("/home");
      } else {
        closePopup();
      }
    });
  }

  if (loading) {
    return (
      <div class="flex items-center justify-center h-[600px]">
        <Spinner />
      </div>
    );
  }

  if (isDev) {
    return <DevApprove />;
  }

  if (!data) {
    return (
      <div class="flex flex-col items-center justify-center h-[600px] px-4 text-center">
        <p class="text-text-secondary text-sm">No pending request.</p>
        <Button class="mt-4" onClick={() => route("/home")}>Back to Wallet</Button>
      </div>
    );
  }

  const { approval, queueSize } = data;

  const title = isTx
    ? isPopupOrigin
      ? "Confirm Send"
      : approval.method === "eth_signTransaction"
        ? "Sign Transaction"
        : "Transaction Request"
    : "Signature Request";

  return (
    <div class="flex flex-col h-[600px]">
      <div class="text-center py-3 border-b border-divider relative">
        <h1 class="text-base font-semibold text-text-primary">{title}</h1>
        {queueSize != null && queueSize > 1 && (
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full">
            +{queueSize - 1} more
          </span>
        )}
      </div>

      {!isPopupOrigin && (
        <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
          <Globe size={16} class="text-text-tertiary" />
          <span class="text-sm text-text-secondary">{approval.origin}</span>
        </div>
      )}

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
        {isTx ? (
          <TxContent
            data={data}
            gasSpeed={gasSpeed}
            setGasSpeed={setGasSpeed}
            showDetails={showDetails}
            setShowDetails={setShowDetails}
            showData={showData}
            setShowData={setShowData}
          />
        ) : (
          <SignContent data={data} />
        )}
      </div>

      <BottomActions>
        <Button variant="secondary" onClick={handleReject} fullWidth disabled={submitting}>
          Reject
        </Button>
        <Button onClick={handleConfirm} fullWidth loading={submitting}>
          {isTx ? "Confirm" : "Sign"}
        </Button>
      </BottomActions>
    </div>
  );
}

/* ── Transaction body ── */

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

interface TxContentProps {
  data: ApprovalData;
  gasSpeed: GasSpeed;
  setGasSpeed: (s: GasSpeed) => void;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  showData: boolean;
  setShowData: (v: boolean) => void;
}

function TxContent({ data, gasSpeed, setGasSpeed, showDetails, setShowDetails, showData, setShowData }: TxContentProps) {
  const detailsRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const { approval, gasPresets, account } = data;
  const txParams = approval.params[0] as TransactionParams;
  const value = formatValue(txParams.value);
  const hasValue = value !== "0";
  const currentGas = gasPresets?.[gasSpeed];

  return (
    <>
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
    </>
  );
}

/* ── Sign message body ── */

function decodeMessage(method: string, params: unknown[]): string {
  if (method === "personal_sign") {
    const hex = params[0] as string;
    if (hex.startsWith("0x")) {
      try {
        const bytes = [];
        for (let i = 2; i < hex.length; i += 2) {
          bytes.push(parseInt(hex.substring(i, i + 2), 16));
        }
        return new TextDecoder().decode(new Uint8Array(bytes));
      } catch {
        return hex;
      }
    }
    return hex;
  }

  if (method === "eth_sign") {
    return params[1] as string;
  }

  if (method === "eth_signTypedData_v4" || method === "eth_signTypedData") {
    try {
      const data = typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];
      return JSON.stringify(data, null, 2);
    } catch {
      return String(params[1]);
    }
  }

  return JSON.stringify(params, null, 2);
}

function getMethodLabel(method: string): string {
  switch (method) {
    case "personal_sign": return "Personal Sign";
    case "eth_sign": return "Eth Sign";
    case "eth_signTypedData_v4":
    case "eth_signTypedData": return "Typed Data";
    default: return "Sign";
  }
}

function SignContent({ data }: { data: ApprovalData }) {
  const { approval, account } = data;
  const message = decodeMessage(approval.method, approval.params);
  const methodLabel = getMethodLabel(approval.method);
  const isTypedData = approval.method.includes("signTypedData");

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full">
          {methodLabel}
        </span>
      </div>

      <p class="text-sm text-text-secondary">
        This site is requesting your signature.
        {approval.method === "eth_sign" && (
          <span class="block mt-1 text-xs text-warning font-medium">
            Warning: eth_sign can sign arbitrary hashes. Only sign if you trust this site.
          </span>
        )}
      </p>

      <Card header="Message" padding={false}>
        <div class="px-4 py-3 max-h-[200px] overflow-y-auto">
          <pre class={`font-mono text-xs text-text-primary whitespace-pre-wrap break-words leading-relaxed ${isTypedData ? "text-[10px]" : ""}`}>
            {message}
          </pre>
        </div>
      </Card>

      <Card>
        <div class="flex items-center gap-3">
          <Identicon address={account.address} size={32} />
          <div>
            <p class="text-xs text-text-secondary">Signing with</p>
            <AddressDisplay address={account.address} />
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Dev mode preview ── */

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function DevApprove() {
  const [mode, setMode] = useState<"tx" | "sign">("tx");

  return mode === "tx" ? <DevTx onSwitch={() => setMode("sign")} /> : <DevSign onSwitch={() => setMode("tx")} />;
}

const COLLAPSED_ARGS = 3;

function formatArgValue(value: string, type: string): string {
  if (type === "address") return `${value.slice(0, 6)}...${value.slice(-4)}`;
  if (value.length > 12) return `${value.slice(0, 8)}...${value.slice(-4)}`;
  return value;
}

function DevTx({ onSwitch }: { onSwitch: () => void }) {
  const tx = MOCK_TX_REQUEST;
  const decoded = tx.decoded;
  const [showDetails, setShowDetails] = useState(false);
  const [showData, setShowData] = useState(false);
  const [argsExpanded, setArgsExpanded] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const argsRef = useRef<HTMLDivElement>(null);

  return (
    <div class="flex flex-col h-[600px]">
      <div class="text-center py-3 border-b border-divider relative">
        <h1 class="text-base font-semibold text-text-primary">Transaction Request</h1>
        <button type="button" onClick={onSwitch} class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full cursor-pointer">
          +1 more
        </button>
      </div>

      <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
        <Globe size={16} class="text-text-tertiary" />
        <span class="text-sm text-text-secondary">{tx.origin}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
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
                <div ref={dataRef} class="border-t border-divider pt-2">
                  <button
                    type="button"
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

function DevSign({ onSwitch }: { onSwitch: () => void }) {
  const req = MOCK_SIGN_REQUEST;
  const account = walletState.activeAccount.value;

  return (
    <div class="flex flex-col h-[600px]">
      <div class="text-center py-3 border-b border-divider relative">
        <h1 class="text-base font-semibold text-text-primary">Signature Request</h1>
        <button type="button" onClick={onSwitch} class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full cursor-pointer">
          +1 more
        </button>
      </div>

      <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
        <Globe size={16} class="text-text-tertiary" />
        <span class="text-sm text-text-secondary">{req.origin}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full">
            Personal Sign
          </span>
        </div>

        <p class="text-sm text-text-secondary">
          This site is requesting your signature.
        </p>

        <Card header="Message" padding={false}>
          <div class="px-4 py-3 max-h-[200px] overflow-y-auto">
            <pre class="font-mono text-xs text-text-primary whitespace-pre-wrap break-words leading-relaxed">
              {req.message}
            </pre>
          </div>
        </Card>

        <Card>
          <div class="flex items-center gap-3">
            <Identicon address={account.address} size={32} />
            <div>
              <p class="text-xs text-text-secondary">Signing with</p>
              <AddressDisplay address={account.address} />
            </div>
          </div>
        </Card>
      </div>

      <BottomActions>
        <Button variant="secondary" onClick={() => route("/home")} fullWidth>
          Reject
        </Button>
        <Button onClick={() => route("/sign-success")} fullWidth>
          Sign
        </Button>
      </BottomActions>
    </div>
  );
}
