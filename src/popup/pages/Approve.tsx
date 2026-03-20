import { NETWORK_BY_ID, POPUP_ORIGIN } from "@shared/constants";
import { truncateAddress } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type {
  DecodedCall,
  GasPresets,
  GasSpeed,
  PendingApproval,
  SerializedAccount,
  TokenTransfer,
  TransactionParams,
} from "@shared/types";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  FileCode,
  Fingerprint,
  Gauge,
  Globe,
  Info,
  Rocket,
  Zap,
} from "lucide-preact";
import type { RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { route } from "preact-router";
import { formatGwei } from "viem";
import { closePopup, pendingApprovalData, routeToNextApprovalOrClose } from "../App";
import { AddressDisplay } from "../components/AddressDisplay";
import { BottomActions } from "../components/BottomActions";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChainIcon } from "../components/ChainIcon";
import { CopyButton } from "../components/CopyButton";
import { FormattedTokenValue } from "../components/FormattedTokenValue";
import { Identicon } from "../components/Identicon";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { MOCK_SIGN_REQUEST, MOCK_TX_REQUEST } from "../mock/data";
import { walletState } from "../store";

const TX_METHODS = new Set(["eth_sendTransaction", "eth_signTransaction"]);

interface ApprovalData {
  approval: PendingApproval;
  gasPresets: GasPresets | null;
  account: SerializedAccount;
  queueSize?: number;
  decoded?: DecodedCall | null;
  transfers?: TokenTransfer[] | null;
  nativeUsdPrice?: number | null;
  decodedVia?: string | null;
  simulatedVia?: string | null;
  hasEtherscanKey?: boolean;
  hasRpcProviderKey?: boolean;
  storageMode?: "keychain" | "vault";
}

export function Approve() {
  const [data, setData] = useState<ApprovalData | null>(null);
  const [gasSpeed, setGasSpeed] = useState<GasSpeed>("normal");
  const [showDetails, setShowDetails] = useState(false);
  const [showData, setShowData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const isDev = import.meta.env.DEV;
  const isVaultMode = data?.storageMode === "vault";

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
      route(isTx ? "/tx-success" : "/sign-success", true);
      return;
    }
    if (!data) return;

    if (isVaultMode && password.length < 4) {
      setAuthError("Enter your password to continue");
      return;
    }

    setAuthError("");
    setSubmitting(true);
    const res = await sendMessage({
      type: "APPROVE_REQUEST",
      id: data.approval.id,
      ...(isTx ? { gasSpeed } : {}),
      ...(isVaultMode ? { password } : {}),
    });
    if (
      !res.ok &&
      (res.error === "Wrong password" || res.error === "Authentication failed or cancelled")
    ) {
      setAuthError(res.error);
      setSubmitting(false);
      return;
    }
    pendingApprovalData.value = null;
    if (res.ok) {
      const result = (res.data as Record<string, unknown>)?.result;
      if (isTx) {
        sessionStorage.setItem(
          "txResult",
          JSON.stringify({ hash: result, method: data.approval.method }),
        );
        route("/tx-success", true);
      } else {
        sessionStorage.setItem("signResult", JSON.stringify({ signature: result }));
        route("/sign-success", true);
      }
    } else {
      if (isTx) {
        sessionStorage.setItem("txResult", JSON.stringify({ error: res.error }));
        route("/tx-error", true);
      } else {
        sessionStorage.setItem("signResult", JSON.stringify({ error: res.error }));
        route("/sign-error", true);
      }
    }
  }

  async function handleReject() {
    if (isDev) {
      route("/home", true);
      return;
    }
    if (data) {
      await sendMessage({ type: "REJECT_REQUEST", id: data.approval.id });
      pendingApprovalData.value = null;
    }
    await routeToNextApprovalOrClose(() => {
      if (isPopupOrigin) {
        route("/home", true);
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
        <Button class="mt-4" onClick={() => route("/home", true)}>
          Back to Wallet
        </Button>
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

  const network = NETWORK_BY_ID.get(approval.chainId);

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

      <div class="flex items-center justify-between px-4 py-1.5 text-xs text-text-tertiary border-b border-divider">
        <div class="flex items-center gap-1.5">
          {network && <ChainIcon chainId={network.chain.id} size={14} />}
          <span>{network?.chain.name ?? `Chain ${approval.chainId}`}</span>
          {network?.chain.testnet && (
            <span class="text-[10px] text-warning font-medium">testnet</span>
          )}
        </div>
        <span class="inline-flex items-center gap-1">
          {data.account.name} · {truncateAddress(data.account.address)}
          <CopyButton text={data.account.address} size={12} />
        </span>
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

      {isVaultMode && (
        <div class="px-4 pt-2">
          <Input
            type="password"
            placeholder="Enter password to sign"
            value={password}
            onInput={(v) => {
              setPassword(v);
              setAuthError("");
            }}
            error={authError || undefined}
          />
        </div>
      )}

      <BottomActions>
        <Button variant="secondary" onClick={handleReject} fullWidth disabled={submitting}>
          Reject
        </Button>
        <Button onClick={handleConfirm} fullWidth loading={submitting}>
          {isVaultMode ? (
            isTx ? (
              "Confirm"
            ) : (
              "Sign"
            )
          ) : (
            <span class="inline-flex items-center gap-1.5">
              <Fingerprint size={16} />
              {isTx ? "Confirm" : "Sign"}
            </span>
          )}
        </Button>
      </BottomActions>
    </div>
  );
}

/* ── Transaction body ── */

const GAS_ICONS = { slow: Gauge, normal: Zap, fast: Rocket } as const;
const GAS_LABELS = { slow: "Slow", normal: "Normal", fast: "Fast" } as const;

function formatGasCost(ethCost: string, nativeUsdPrice: number | null | undefined): string {
  const eth = parseFloat(ethCost);
  if (nativeUsdPrice && nativeUsdPrice > 0) {
    const usd = eth * nativeUsdPrice;
    return usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`;
  }
  return `${eth.toFixed(6)} ETH`;
}

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

interface TxContentProps {
  data: ApprovalData;
  gasSpeed: GasSpeed;
  setGasSpeed: (s: GasSpeed) => void;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  showData: boolean;
  setShowData: (v: boolean) => void;
}

function ApiKeyHint({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => route("/settings", true)}
      class="flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
    >
      <Info size={12} class="shrink-0" />
      <span>{text}</span>
      <span class="text-accent">Settings</span>
    </button>
  );
}

function TxContent({
  data,
  gasSpeed,
  setGasSpeed,
  showDetails,
  setShowDetails,
  showData,
  setShowData,
}: TxContentProps) {
  const detailsRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const argsRef = useRef<HTMLButtonElement>(null);
  const [argsExpanded, setArgsExpanded] = useState(false);
  const {
    approval,
    gasPresets,
    decoded,
    transfers,
    nativeUsdPrice,
    decodedVia,
    simulatedVia,
    hasEtherscanKey,
    hasRpcProviderKey,
  } = data;
  const txParams = approval.params[0] as TransactionParams;
  const currentGas = gasPresets?.[gasSpeed];
  const hasCalldata = !!(txParams.data && txParams.data !== "0x" && txParams.data.length >= 10);
  const showEtherscanHint = hasCalldata && !hasEtherscanKey && decodedVia !== "etherscan";
  const showAlchemyHint = hasCalldata && !hasRpcProviderKey && simulatedVia === "fallback";

  return (
    <>
      {decoded && (
        <DecodedCallCard
          decoded={decoded}
          toAddress={txParams.to}
          argsExpanded={argsExpanded}
          setArgsExpanded={setArgsExpanded}
          argsRef={argsRef}
        />
      )}

      {showEtherscanHint && <ApiKeyHint text="Add Etherscan key for better tx decoding —" />}

      {transfers && transfers.length > 0 && <TransfersCard transfers={transfers} />}

      {showAlchemyHint && <ApiKeyHint text="Add Alchemy key for transaction simulation —" />}

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
              <span class="text-xs text-text-secondary uppercase tracking-wider font-semibold">
                Gas & Details
              </span>
              {showDetails ? (
                <ChevronUp size={14} class="text-text-tertiary" />
              ) : (
                <ChevronDown size={14} class="text-text-tertiary" />
              )}
            </div>
          </button>

          {gasPresets && (
            <div class="px-4 pb-3">
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
                      <span
                        class={`text-xs font-medium ${active ? "text-accent" : "text-text-secondary"}`}
                      >
                        {GAS_LABELS[speed]}
                      </span>
                      <span class="font-mono text-[10px] text-text-tertiary">
                        {formatGasCost(estimate.estimatedCostEth, nativeUsdPrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showDetails && (
            <div class="px-4 pb-3 space-y-2 text-sm border-t border-divider pt-2.5">
              {currentGas && (
                <>
                  <div class="flex justify-between">
                    <span class="text-text-secondary">Estimated fee</span>
                    <span class="font-mono font-medium text-text-primary inline-flex items-baseline gap-0.5 flex-wrap justify-end">
                      <FormattedTokenValue value={currentGas.estimatedCostEth} />
                      <span>ETH</span>
                    </span>
                  </div>
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
                      {parseFloat(formatGwei(BigInt(currentGas.maxPriorityFeePerGas))).toFixed(2)}{" "}
                      gwei
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
    case "personal_sign":
      return "Personal Sign";
    case "eth_sign":
      return "Eth Sign";
    case "eth_signTypedData_v4":
    case "eth_signTypedData":
      return "Typed Data";
    default:
      return "Sign";
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
          <pre
            class={`font-mono text-xs text-text-primary whitespace-pre-wrap break-words leading-relaxed ${isTypedData ? "text-[10px]" : ""}`}
          >
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

/* ── Shared sub-components ── */

const COLLAPSED_ARGS = 3;

function formatArgValue(value: string, type: string): string {
  if (type === "address") return `${value.slice(0, 6)}...${value.slice(-4)}`;
  if (value.length > 12) return `${value.slice(0, 8)}...${value.slice(-4)}`;
  return value;
}

function DecodedCallCard({
  decoded,
  toAddress,
  argsExpanded,
  setArgsExpanded,
  argsRef,
}: {
  decoded: DecodedCall;
  toAddress: string;
  argsExpanded: boolean;
  setArgsExpanded: (v: boolean) => void;
  argsRef: RefObject<HTMLButtonElement>;
}) {
  return (
    <Card>
      <p class="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-2.5">
        Contract Action
      </p>
      <div class="space-y-2.5">
        <div class="flex items-center gap-2">
          <FileCode size={16} class="text-accent shrink-0" />
          <p class="font-mono text-sm font-semibold text-accent truncate">
            {decoded.functionName}()
          </p>
        </div>

        {decoded.args.length > 0 && (
          <button
            type="button"
            ref={argsRef}
            class="bg-base rounded-[var(--radius-chip)] divide-y divide-divider cursor-pointer w-full text-left"
            onClick={() => {
              const expanding = !argsExpanded;
              setArgsExpanded(expanding);
              if (expanding && argsRef.current) scrollEndIntoView(argsRef);
            }}
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
                  <>
                    <ChevronUp size={12} /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} /> {decoded.args.length - COLLAPSED_ARGS} more
                  </>
                )}
              </div>
            )}
          </button>
        )}

        <div class="flex items-center justify-between pt-1.5 border-t border-divider">
          <span class="text-xs text-text-secondary">Interacting with</span>
          <span class="inline-flex items-center gap-1 font-mono text-xs text-text-primary">
            {decoded.contractName ? (
              <>
                {decoded.contractName}{" "}
                <span class="text-text-tertiary">({truncateAddress(toAddress)})</span>
              </>
            ) : (
              truncateAddress(toAddress)
            )}
            <CopyButton text={toAddress} size={12} />
          </span>
        </div>
      </div>
    </Card>
  );
}

function TransfersCard({ transfers }: { transfers: TokenTransfer[] }) {
  return (
    <Card>
      <p class="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-2">
        Token Transfers
      </p>
      <div class="divide-y divide-divider">
        {transfers.map((t, i) => (
          <div key={`${t.direction}-${t.symbol}-${i}`} class="flex items-center gap-2.5 py-2">
            <div class="relative">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: t.color }}
              >
                {t.symbol.slice(0, 1)}
              </div>
              <div
                class={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${t.direction === "out" ? "bg-danger" : "bg-success"}`}
              >
                {t.direction === "out" ? (
                  <ArrowUpRight size={9} class="text-white" />
                ) : (
                  <ArrowDownLeft size={9} class="text-white" />
                )}
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text-primary">
                {t.direction === "out" ? "Send" : "Receive"} {t.symbol}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p
                class={`font-mono text-sm font-medium inline-flex items-baseline flex-wrap justify-end gap-x-0.5 ${t.direction === "out" ? "text-danger" : "text-success"}`}
              >
                <span>{t.direction === "out" ? "-" : "+"}</span>
                <FormattedTokenValue value={t.amount} />
                <span>{t.symbol}</span>
              </p>
              <p class="text-xs text-text-secondary">{t.usdValue ?? "--"}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── Dev mode preview ── */

function DevApprove() {
  const [mode, setMode] = useState<"tx" | "sign">("tx");

  return mode === "tx" ? (
    <DevTx onSwitch={() => setMode("sign")} />
  ) : (
    <DevSign onSwitch={() => setMode("tx")} />
  );
}

function DevTx({ onSwitch }: { onSwitch: () => void }) {
  const tx = MOCK_TX_REQUEST;
  const account = walletState.activeAccount.value;
  const network = walletState.activeNetwork.value;
  const [showDetails, setShowDetails] = useState(false);
  const [showData, setShowData] = useState(false);
  const [argsExpanded, setArgsExpanded] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const argsRef = useRef<HTMLButtonElement>(null);

  return (
    <div class="flex flex-col h-[600px]">
      <div class="text-center py-3 border-b border-divider relative">
        <h1 class="text-base font-semibold text-text-primary">Transaction Request</h1>
        <button
          type="button"
          onClick={onSwitch}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full cursor-pointer"
        >
          +1 more
        </button>
      </div>

      <div class="flex items-center justify-between px-4 py-1.5 text-xs text-text-tertiary border-b border-divider">
        <div class="flex items-center gap-1.5">
          <ChainIcon chainId={network.chain.id} size={14} />
          <span>{network.chain.name}</span>
        </div>
        <span class="inline-flex items-center gap-1">
          {account.name} · {truncateAddress(account.address)}
          <CopyButton text={account.address} size={12} />
        </span>
      </div>

      <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
        <Globe size={16} class="text-text-tertiary" />
        <span class="text-sm text-text-secondary">{tx.origin}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
        {tx.decoded && (
          <DecodedCallCard
            decoded={tx.decoded}
            toAddress={tx.params.to}
            argsExpanded={argsExpanded}
            setArgsExpanded={setArgsExpanded}
            argsRef={argsRef}
          />
        )}

        <TransfersCard transfers={tx.transfers} />

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
                <span class="text-xs text-text-secondary uppercase tracking-wider font-semibold">
                  Gas & Details
                </span>
                {showDetails ? (
                  <ChevronUp size={14} class="text-text-tertiary" />
                ) : (
                  <ChevronDown size={14} class="text-text-tertiary" />
                )}
              </div>
            </button>

            <div class="px-4 pb-3">
              <div class="grid grid-cols-3 gap-2">
                {(["slow", "normal", "fast"] as GasSpeed[]).map((speed) => {
                  const Icon = GAS_ICONS[speed];
                  const mockEth =
                    speed === "slow" ? "0.001200" : speed === "normal" ? "0.001440" : "0.001800";
                  return (
                    <button
                      type="button"
                      key={speed}
                      class={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-[var(--radius-chip)] border transition-all cursor-pointer ${
                        speed === "normal"
                          ? "border-accent bg-accent-light"
                          : "border-divider hover:border-text-tertiary"
                      }`}
                    >
                      <Icon
                        size={16}
                        class={speed === "normal" ? "text-accent" : "text-text-tertiary"}
                      />
                      <span
                        class={`text-xs font-medium ${speed === "normal" ? "text-accent" : "text-text-secondary"}`}
                      >
                        {GAS_LABELS[speed]}
                      </span>
                      <span class="font-mono text-[10px] text-text-tertiary">
                        {formatGasCost(mockEth, 2430)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {showDetails && (
              <div class="px-4 pb-3 space-y-2 text-sm border-t border-divider pt-2.5">
                <div class="flex justify-between">
                  <span class="text-text-secondary">Estimated fee</span>
                  <span class="font-mono font-medium text-text-primary">{tx.estimatedFee}</span>
                </div>
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
        <Button variant="secondary" onClick={() => route("/home", true)} fullWidth>
          Reject
        </Button>
        <Button onClick={() => route("/tx-success", true)} fullWidth>
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
        <button
          type="button"
          onClick={onSwitch}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full cursor-pointer"
        >
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

        <p class="text-sm text-text-secondary">This site is requesting your signature.</p>

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
        <Button variant="secondary" onClick={() => route("/home", true)} fullWidth>
          Reject
        </Button>
        <Button onClick={() => route("/sign-success", true)} fullWidth>
          Sign
        </Button>
      </BottomActions>
    </div>
  );
}
