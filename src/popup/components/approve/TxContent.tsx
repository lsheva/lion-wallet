import type { ApprovalData, GasSpeed, TransactionParams } from "@shared/types";
import { useNavigate } from "@solidjs/router";
import { ChevronDown, ChevronUp, Info } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { formatGwei } from "viem/utils";
import { Card } from "../Card";
import { CopyButton } from "../CopyButton";
import { FormattedTokenValue } from "../FormattedTokenValue";
import { DecodedCallCard } from "./DecodedCallCard";
import { formatGasCost, GAS_ICONS, GAS_LABELS, scrollEndIntoView } from "./helpers";
import { TransfersCard } from "./TransfersCard";

function ApiKeyHint(props: { text: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/settings", { replace: true })}
      class="flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
    >
      <Info size={12} class="shrink-0" />
      <span>{props.text}</span>
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

export function TxContent(props: TxContentProps) {
  let detailsRef: HTMLDivElement | undefined;
  let dataRef: HTMLDivElement | undefined;
  const [argsExpanded, setArgsExpanded] = createSignal(false);

  const txParams = () => props.data.approval.params[0] as TransactionParams;
  const currentGas = () => props.data.gasPresets?.[props.gasSpeed];
  const hasCalldata = () => {
    const d = txParams().data;
    return !!(d && d !== "0x" && d.length >= 10);
  };
  const showEtherscanHint = () =>
    hasCalldata() && !props.data.hasEtherscanKey && props.data.decodedVia !== "etherscan";
  const showAlchemyHint = () =>
    hasCalldata() && !props.data.hasRpcProviderKey && props.data.simulatedVia === "fallback";

  return (
    <>
      <Show when={props.data.decoded}>
        {(decoded) => (
          <DecodedCallCard
            decoded={decoded()}
            toAddress={txParams().to}
            argsExpanded={argsExpanded()}
            setArgsExpanded={setArgsExpanded}
          />
        )}
      </Show>

      <Show when={showEtherscanHint()}>
        <ApiKeyHint text="Add Etherscan key for better tx decoding —" />
      </Show>

      <Show when={props.data.transfers && props.data.transfers.length > 0}>
        <TransfersCard transfers={props.data.transfers ?? []} />
      </Show>

      <Show when={showAlchemyHint()}>
        <ApiKeyHint text="Add Alchemy key for transaction simulation —" />
      </Show>

      <div ref={detailsRef}>
        <Card padding={false}>
          <button
            type="button"
            class="cursor-pointer w-full text-left"
            onClick={() => {
              const expanding = !props.showDetails;
              props.setShowDetails(expanding);
              if (expanding) scrollEndIntoView(detailsRef);
            }}
          >
            <div class="flex items-center justify-between px-4 py-2.5">
              <span class="text-xs text-text-secondary uppercase tracking-wider font-semibold">
                Gas & Details
              </span>
              <Show
                when={props.showDetails}
                fallback={<ChevronDown size={14} class="text-text-tertiary" />}
              >
                <ChevronUp size={14} class="text-text-tertiary" />
              </Show>
            </div>
          </button>

          <Show when={props.data.gasPresets}>
            <div class="px-4 pb-3">
              <div class="grid grid-cols-3 gap-2">
                <For each={["slow", "normal", "fast"] as GasSpeed[]}>
                  {(speed) => {
                    const estimate = () => props.data.gasPresets?.[speed];
                    const Icon = GAS_ICONS[speed];
                    const active = () => props.gasSpeed === speed;
                    return (
                      <button
                        type="button"
                        onClick={() => props.setGasSpeed(speed)}
                        class={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-[var(--radius-chip)] border transition-all cursor-pointer ${
                          active()
                            ? "border-accent bg-accent-light"
                            : "border-divider hover:border-text-tertiary"
                        }`}
                      >
                        <Icon size={16} class={active() ? "text-accent" : "text-text-tertiary"} />
                        <span
                          class={`text-xs font-medium ${active() ? "text-accent" : "text-text-secondary"}`}
                        >
                          {GAS_LABELS[speed]}
                        </span>
                        <span class="font-mono text-[10px] text-text-tertiary">
                          {formatGasCost(
                            estimate()?.estimatedCostEth ?? "0",
                            props.data.nativeUsdPrice,
                          )}
                        </span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>

          <Show when={props.showDetails}>
            <div class="px-4 pb-3 space-y-2 text-sm border-t border-divider pt-2.5">
              <Show when={currentGas()}>
                <div class="flex justify-between">
                  <span class="text-text-secondary">Estimated fee</span>
                  <span class="font-mono font-medium text-text-primary inline-flex items-baseline gap-0.5 flex-wrap justify-end">
                    <FormattedTokenValue value={currentGas()?.estimatedCostEth ?? "0"} />
                    <span>ETH</span>
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">Gas Limit</span>
                  <span class="font-mono text-text-primary">{currentGas()?.gasLimit}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">Max Fee</span>
                  <span class="font-mono text-text-primary">
                    {parseFloat(formatGwei(BigInt(currentGas()?.maxFeePerGas ?? "0"))).toFixed(2)}{" "}
                    gwei
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">Priority Fee</span>
                  <span class="font-mono text-text-primary">
                    {parseFloat(
                      formatGwei(BigInt(currentGas()?.maxPriorityFeePerGas ?? "0")),
                    ).toFixed(2)}{" "}
                    gwei
                  </span>
                </div>
                <Show when={props.data.gasPresets}>
                  <div class="flex justify-between">
                    <span class="text-text-secondary">Base Fee</span>
                    <span class="font-mono text-text-primary">
                      {parseFloat(props.data.gasPresets?.baseFeeGwei ?? "0").toFixed(2)} gwei
                    </span>
                  </div>
                </Show>
              </Show>
              <Show when={txParams().data && txParams().data !== "0x"}>
                <div ref={dataRef} class="border-t border-divider pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const expanding = !props.showData;
                      props.setShowData(expanding);
                      if (expanding) scrollEndIntoView(dataRef);
                    }}
                    class="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
                  >
                    <span>{props.showData ? "Hide" : "Show"} raw data</span>
                    <Show when={props.showData} fallback={<ChevronDown size={12} />}>
                      <ChevronUp size={12} />
                    </Show>
                  </button>
                  <Show when={props.showData}>
                    <div class="mt-2 relative">
                      <pre class="font-mono text-[10px] text-text-secondary bg-base rounded-[var(--radius-chip)] p-2 break-all whitespace-pre-wrap max-h-[80px] overflow-y-auto leading-relaxed">
                        {txParams().data}
                      </pre>
                      <div class="absolute top-1 right-1">
                        <CopyButton text={txParams().data ?? ""} size={12} />
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>
        </Card>
      </div>
    </>
  );
}
