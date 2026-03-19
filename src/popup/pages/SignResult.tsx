import { useEffect } from "preact/hooks";
import { CheckCircle2, XCircle } from "lucide-preact";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CopyButton } from "../components/CopyButton";
import { routeToNextApprovalOrClose, closePopup } from "../App";

interface SignResultProps {
  status?: "success" | "error";
}

export function SignResult({ status = "success" }: SignResultProps) {
  const isSuccess = status === "success";

  const stored = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("signResult") ?? "{}");
    } catch {
      return {};
    }
  })();

  const signature = stored.signature as string | undefined;
  const errorMessage = stored.error as string | undefined;

  useEffect(() => {
    return () => sessionStorage.removeItem("signResult");
  }, []);

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

      <div class="w-full space-y-3">
        <Button onClick={() => routeToNextApprovalOrClose(closePopup)} size="lg">
          Done
        </Button>
      </div>
    </div>
  );
}
