import { route } from "preact-router";
import { CheckCircle2, XCircle } from "lucide-preact";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CopyButton } from "../components/CopyButton";

interface SignResultProps {
  status?: "success" | "error";
}

const MOCK_SIGNATURE = "0x4a8b9c2d1e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c00";

export function SignResult({ status = "success" }: SignResultProps) {
  const isSuccess = status === "success";

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

      {isSuccess && (
        <Card class="w-full mb-6">
          <div class="flex items-center justify-between mb-1.5">
            <p class="text-xs text-text-secondary">Signature</p>
            <CopyButton text={MOCK_SIGNATURE} size={14} />
          </div>
          <p class="font-mono text-[10px] text-text-primary leading-relaxed break-all">
            {MOCK_SIGNATURE}
          </p>
        </Card>
      )}

      {!isSuccess && (
        <Card class="w-full mb-6">
          <p class="text-xs text-text-secondary mb-1">Error</p>
          <p class="font-mono text-xs text-danger leading-relaxed">
            Error: user rejected the signing request
          </p>
        </Card>
      )}

      <div class="w-full space-y-3">
        <Button onClick={() => route("/home")} size="lg">
          {isSuccess ? "Done" : "Back to Wallet"}
        </Button>
        {!isSuccess && (
          <Button variant="secondary" onClick={() => route("/sign-message")} size="lg">
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
