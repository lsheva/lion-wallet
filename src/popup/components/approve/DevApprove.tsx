import { truncateAddress } from "@shared/format";
import type { GasSpeed } from "@shared/types";
import { ChevronDown, ChevronUp, Gauge, Globe, Rocket, Zap } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import { route } from "preact-router";
import { AddressDisplay } from "../AddressDisplay";
import { BottomActions } from "../BottomActions";
import { Button } from "../Button";
import { Card } from "../Card";
import { ChainIcon } from "../ChainIcon";
import { CopyButton } from "../CopyButton";
import { Identicon } from "../Identicon";
import { MOCK_SIGN_REQUEST, MOCK_TX_REQUEST } from "../../mock/data";
import { walletState } from "../../store";
import { DecodedCallCard } from "./DecodedCallCard";
import { TransfersCard } from "./TransfersCard";
import { formatGasCost, scrollEndIntoView } from "./helpers";

const GAS_ICONS = { slow: Gauge, normal: Zap, fast: Rocket } as const;
const GAS_LABELS = { slow: "Slow", normal: "Normal", fast: "Fast" } as const;

export function DevApprove() {
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
