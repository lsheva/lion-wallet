import { useState, useEffect, useRef } from "preact/hooks";
import { CheckCircle2, XCircle } from "lucide-preact";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CopyButton } from "../components/CopyButton";
import { routeToNextApprovalOrClose, closePopup, pendingQueueSize } from "../App";

interface SignResultProps {
  status?: "success" | "error";
}

export function SignResult({ status = "success" }: SignResultProps) {
  const isDev = import.meta.env.DEV;
  const isSuccess = status === "success";
  const [autoCloseIn, setAutoCloseIn] = useState<number | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setInterval>>();

  const stored = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("signResult") ?? "{}");
    } catch {
      return {};
    }
  })();

  const signature = stored.signature as string | undefined;
  const errorMessage = stored.error as string | undefined;
  const queueSize = pendingQueueSize.value;

  useEffect(() => {
    return () => sessionStorage.removeItem("signResult");
  }, []);

  useEffect(() => {
    if (isDev || !isSuccess || queueSize <= 0) return;
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
  }, [isDev, isSuccess, queueSize]);

  return (
    <div class="flex flex-col items-center justify-center h-[600px] px-4">
      <div class={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${isSuccess ? "bg-success/10" : "bg-danger/10"}`}>
        {isSuccess ? (
          <CheckCircle2 size={40} class="text-success" />
        ) : (
          <XCircle size={40} class="text-danger" />
        )}
      </div>

      <h1 class="text-xl font-semibold text-text-primary mb-1">
        {isSuccess ? "Message Signed" : "Signing Failed"}
      </h1>
      <p class="text-sm text-text-secondary text-center mb-6">
        {isSuccess
          ? "The message has been signed successfully."
          : "Something went wrong. The message was not signed."}
      </p>

      {isSuccess && signature && (
        <Card class="w-full mb-6">
          <div class="flex items-center justify-between mb-1.5">
            <p class="text-xs text-text-secondary">Signature</p>
            <CopyButton text={signature} size={14} />
          </div>
          <p class="font-mono text-[10px] text-text-primary leading-relaxed break-all">
            {signature}
          </p>
        </Card>
      )}

      {!isSuccess && (
        <Card class="w-full mb-6">
          <p class="text-xs text-text-secondary mb-1">Error</p>
          <p class="font-mono text-xs text-danger leading-relaxed">
            {errorMessage ?? "User rejected the signing request"}
          </p>
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
        >
          Done
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
