import type { ApprovalData, GasSpeed, TransactionParams } from "@shared/types";
import { ChevronDown, ChevronUp, Info } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import { route } from "preact-router";
import { formatGwei } from "viem";
import { Card } from "../Card";
import { CopyButton } from "../CopyButton";
import { FormattedTokenValue } from "../FormattedTokenValue";
import { DecodedCallCard } from "./DecodedCallCard";
import { formatGasCost, GAS_ICONS, GAS_LABELS, scrollEndIntoView } from "./helpers";
import { TransfersCard } from "./TransfersCard";

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

export interface TxContentProps {
  data: ApprovalData;
  gasSpeed: GasSpeed;
  setGasSpeed: (s: GasSpeed) => void;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  showData: boolean;
  setShowData: (v: boolean) => void;
}

export function TxContent({
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
