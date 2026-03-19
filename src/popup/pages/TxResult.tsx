import { useState, useEffect, useRef } from "preact/hooks";
import { route } from "preact-router";
import { CheckCircle2, XCircle, Loader2 } from "lucide-preact";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { AddressDisplay } from "../components/AddressDisplay";

interface TxResultProps {
  status?: "success" | "error";
}

const REQUIRED_CONFIRMATIONS = 12;

export function TxResult({ status = "success" }: TxResultProps) {
  const isError = status === "error";
  const [confirmations, setConfirmations] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const stored = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("txResult") ?? "{}");
    } catch {
      return {};
    }
  })();

  const txHash = stored.hash as string | undefined;
  const errorMessage = stored.error as string | undefined;

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

  useEffect(() => {
    return () => sessionStorage.removeItem("txResult");
  }, []);

  const progressPct = Math.min((confirmations / REQUIRED_CONFIRMATIONS) * 100, 100);

  if (isError) {
    return (
      <div class="flex flex-col items-center justify-center h-[600px] px-4">
        <div class="w-16 h-16 rounded-full flex items-center justify-center mb-5 bg-danger/10">
          <XCircle size={40} class="text-danger" />
        </div>
        <h1 class="text-xl font-semibold text-text-primary mb-1">Transaction Failed</h1>
        <p class="text-sm text-text-secondary text-center mb-6">
          Something went wrong. The transaction was not submitted.
        </p>
        <Card class="w-full mb-6">
          <p class="text-xs text-text-secondary mb-1">Error</p>
          <p class="font-mono text-xs text-danger leading-relaxed">
            {errorMessage ?? "Unknown error occurred"}
          </p>
        </Card>
        <div class="w-full space-y-3">
          <Button onClick={() => route("/home")} size="lg">Back to Wallet</Button>
        </div>
      </div>
    );
  }

  return (
    <div class="flex flex-col items-center justify-center h-[600px] px-4">
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

      {txHash && (
        <Card class="w-full mb-6">
          <div class="space-y-3">
            <div class="border-t border-divider pt-3">
              <p class="text-xs text-text-secondary mb-1">Transaction Hash</p>
              <AddressDisplay address={txHash} />
            </div>
          </div>
        </Card>
      )}

      <div class="w-full">
        <Button onClick={() => route("/home")} size="lg" variant={mined ? "primary" : "secondary"}>
          {mined ? "Done" : "Dismiss"}
        </Button>
      </div>
    </div>
  );
}
