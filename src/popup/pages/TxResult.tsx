import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { route } from "preact-router";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-preact";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { AddressDisplay } from "../components/AddressDisplay";
import { sendMessage } from "@shared/messages";
import { POPUP_ORIGIN, NETWORK_BY_ID } from "@shared/constants";
import { walletState } from "../store";
import { routeToNextApprovalOrClose, closePopup, pendingQueueSize } from "../App";

interface TxResultProps {
  status?: "success" | "error";
}

const TARGET_CONFIRMATIONS = 12;
const POLL_INTERVAL_MS = 4000;

export function TxResult({ status = "success" }: TxResultProps) {
  const isDev = import.meta.env.DEV;
  const isError = status === "error";
  const [confirmations, setConfirmations] = useState(0);
  const [mined, setMined] = useState(false);
  const [autoCloseIn, setAutoCloseIn] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const autoCloseRef = useRef<ReturnType<typeof setInterval>>();
  const receiptBlockRef = useRef<bigint | null>(null);

  const stored = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("txResult") ?? "{}");
    } catch {
      return {};
    }
  })();

  const txHash = stored.hash as string | undefined;
  const errorMessage = stored.error as string | undefined;
  const queueSize = pendingQueueSize.value;

  const network = walletState.activeNetwork.value;
  const explorerUrl = NETWORK_BY_ID.get(network.chain.id)?.chain.blockExplorers?.default?.url;
  const txExplorerUrl =
    explorerUrl && txHash ? `${explorerUrl}/tx/${txHash}` : null;

  const rpc = useCallback(
    async (method: string, params: unknown[]) => {
      const res = await sendMessage({
        type: "RPC_REQUEST",
        id: crypto.randomUUID(),
        method,
        params,
        origin: POPUP_ORIGIN,
      });
      if (!res.ok) return null;
      return (res.data as { result: unknown })?.result ?? null;
    },
    [],
  );

  useEffect(() => {
    if (isError || !txHash || isDev) {
      if (isDev && !isError) {
        intervalRef.current = setInterval(() => {
          setConfirmations((c) => {
            if (c >= TARGET_CONFIRMATIONS) {
              clearInterval(intervalRef.current);
              setMined(true);
              return TARGET_CONFIRMATIONS;
            }
            return c + 1;
          });
        }, 600);
        return () => clearInterval(intervalRef.current);
      }
      return;
    }

    async function poll() {
      if (receiptBlockRef.current === null) {
        const receipt = (await rpc("eth_getTransactionReceipt", [txHash])) as {
          blockNumber?: string;
          status?: string;
        } | null;
        if (receipt?.blockNumber) {
          receiptBlockRef.current = BigInt(receipt.blockNumber);
          if (receipt.status === "0x0") {
            clearInterval(intervalRef.current);
            sessionStorage.setItem(
              "txResult",
              JSON.stringify({ ...stored, error: "Transaction reverted" }),
            );
            route("/tx-error", true);
            return;
          }
        }
      }

      if (receiptBlockRef.current !== null) {
        const latestHex = (await rpc("eth_blockNumber", [])) as string | null;
        if (latestHex) {
          const latest = BigInt(latestHex);
          const confs = Number(latest - receiptBlockRef.current) + 1;
          const clamped = Math.min(confs, TARGET_CONFIRMATIONS);
          setConfirmations(clamped);
          if (clamped >= TARGET_CONFIRMATIONS) {
            setMined(true);
            clearInterval(intervalRef.current);
          }
        }
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [isError, txHash, isDev, rpc]);

  useEffect(() => {
    return () => sessionStorage.removeItem("txResult");
  }, []);

  useEffect(() => {
    if (isDev || isError || queueSize <= 0) return;
    setAutoCloseIn(5);
    let seconds = 5;
    autoCloseRef.current = setInterval(() => {
      seconds--;
      setAutoCloseIn(seconds);
      if (seconds <= 0) {
        clearInterval(autoCloseRef.current);
        routeToNextApprovalOrClose(closePopup);
      }
    }, 1000);
    return () => clearInterval(autoCloseRef.current);
  }, [isDev, isError, queueSize]);

  const progressPct = Math.min(
    (confirmations / TARGET_CONFIRMATIONS) * 100,
    100,
  );

  if (isError) {
    return (
      <div class="flex flex-col items-center justify-center h-[600px] px-4">
        <div class="w-16 h-16 rounded-full flex items-center justify-center mb-5 bg-danger/10">
          <XCircle size={40} class="text-danger" />
        </div>
        <h1 class="text-xl font-semibold text-text-primary mb-1">
          Transaction Failed
        </h1>
        <p class="text-sm text-text-secondary text-center mb-6">
          Something went wrong. The transaction was not submitted.
        </p>
        <Card class="w-full mb-6">
          <p class="text-xs text-text-secondary mb-1">Error</p>
          <p class="font-mono text-xs text-danger leading-relaxed">
            {errorMessage ?? "Unknown error occurred"}
          </p>
        </Card>
        <div class="w-full space-y-2">
          <Button onClick={() => routeToNextApprovalOrClose(closePopup)} size="lg">
            {isDev ? "Back to Wallet" : "Done"}
          </Button>
          {queueSize > 0 && (
            <p class="text-xs text-text-tertiary text-center">
              {queueSize} pending request{queueSize > 1 ? "s" : ""} remaining
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class="flex flex-col items-center justify-center h-[600px] px-4">
      <div
        class={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${mined ? "bg-success/10" : "bg-accent-light"}`}
      >
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
            {confirmations}/{TARGET_CONFIRMATIONS} blocks
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
            <div>
              <p class="text-xs text-text-secondary mb-1">Transaction Hash</p>
              <AddressDisplay address={txHash} />
            </div>
            {txExplorerUrl && (
              <a
                href={txExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                <ExternalLink size={12} />
                View on Explorer
              </a>
            )}
          </div>
        </Card>
      )}

      <div class="w-full space-y-2">
        <Button
          onClick={() => {
            clearInterval(autoCloseRef.current);
            if (queueSize > 0) {
              routeToNextApprovalOrClose(closePopup);
            } else {
              closePopup();
            }
          }}
          size="lg"
          variant={mined ? "primary" : "secondary"}
        >
          {mined ? "Done" : "Dismiss"}
        </Button>
        {queueSize > 0 && (
          <p class="text-xs text-text-tertiary text-center">
            {queueSize} pending request{queueSize > 1 ? "s" : ""} remaining
            {autoCloseIn != null && ` · next in ${autoCloseIn}s`}
          </p>
        )}
      </div>
    </div>
  );
}
