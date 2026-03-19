import { useState, useEffect, useRef } from "preact/hooks";
import { route } from "preact-router";
import { CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-preact";
import { Button } from "../components/Button";
import { AddressDisplay } from "../components/AddressDisplay";

interface TxResultProps {
  status?: "success" | "error";
}

const MOCK_TX_HASH = "0x9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b";
const REQUIRED_CONFIRMATIONS = 12;

export function TxResult({ status = "success" }: TxResultProps) {
  const isError = status === "error";
  const [confirmations, setConfirmations] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const mined = confirmations >= REQUIRED_CONFIRMATIONS;

  useEffect(() => {
    if (isError) return;
    intervalRef.current = setInterval(() => {
      setConfirmations((c) => {
        if (c >= REQUIRED_CONFIRMATIONS) {
          clearInterval(intervalRef.current);
          return REQUIRED_CONFIRMATIONS;
        }
        return c + 1;
      });
    }, 800);
    return () => clearInterval(intervalRef.current);
  }, [isError]);

  const progressPct = Math.min((confirmations / REQUIRED_CONFIRMATIONS) * 100, 100);

  if (isError) {
    return (
      <div class="flex flex-col items-center justify-center h-[600px] px-8">
        <div class="w-16 h-16 rounded-full flex items-center justify-center mb-5 bg-danger/10">
          <XCircle size={40} class="text-danger" />
        </div>
        <h1 class="text-xl font-semibold text-text-primary mb-1">Transaction Failed</h1>
        <p class="text-sm text-text-secondary text-center mb-6">
          Something went wrong. The transaction was not submitted.
        </p>
        <div class="w-full bg-surface rounded-[var(--radius-card)] p-4 mb-6">
          <p class="text-xs text-text-secondary mb-1">Error</p>
          <p class="font-mono text-xs text-danger leading-relaxed">
            Error: insufficient funds for gas * price + value: balance 0.001 ETH, tx cost 0.5 ETH
          </p>
        </div>
        <div class="w-full space-y-3">
          <Button onClick={() => route("/home")} size="lg">Back to Wallet</Button>
          <Button variant="secondary" onClick={() => route("/tx-approval")} size="lg">Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div class="flex flex-col items-center justify-center h-[600px] px-8">
      {/* Icon: spinner while pending, checkmark when mined */}
      <div class={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${mined ? "bg-success/10" : "bg-accent-light"}`}>
        {mined ? (
          <CheckCircle2 size={40} class="text-success" />
        ) : (
          <Loader2 size={36} class="text-accent animate-spin" />
        )}
      </div>

      <h1 class="text-xl font-semibold text-text-primary mb-1">
        {mined ? "Transaction Confirmed" : "Transaction Sent"}
      </h1>
      <p class="text-sm text-text-secondary text-center mb-5">
        {mined
          ? "Your transaction has been confirmed on the network."
          : "Waiting for confirmations..."}
      </p>

      {/* Confirmation progress */}
      <div class="w-full mb-5">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="text-text-secondary">
            {mined ? "Confirmed" : "Confirming"}
          </span>
          <span class="font-mono text-text-primary">
            {confirmations}/{REQUIRED_CONFIRMATIONS} blocks
          </span>
        </div>
        <div class="w-full h-1.5 bg-divider rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all duration-500 ease-out ${mined ? "bg-success" : "bg-accent"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* TX details */}
      <div class="w-full bg-surface rounded-[var(--radius-card)] p-4 mb-6 space-y-3">
        <div class="flex justify-between text-sm">
          <span class="text-text-secondary">Amount</span>
          <span class="font-mono font-medium text-text-primary">0.5 ETH</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-text-secondary">Fee</span>
          <span class="font-mono text-text-primary">~$2.40</span>
        </div>
        <div class="border-t border-divider pt-3">
          <p class="text-xs text-text-secondary mb-1">Transaction Hash</p>
          <AddressDisplay address={MOCK_TX_HASH} />
        </div>
        <button class="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer">
          <span>View on Explorer</span>
          <ExternalLink size={12} />
        </button>
      </div>

      <div class="w-full">
        <Button onClick={() => route("/home")} size="lg" variant={mined ? "primary" : "secondary"}>
          {mined ? "Done" : "Dismiss"}
        </Button>
      </div>
    </div>
  );
}
