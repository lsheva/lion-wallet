import { CheckCircle2, XCircle } from "lucide-solid";
import { onCleanup, Show } from "solid-js";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CopyButton } from "../components/CopyButton";
import { useAutoCloseQueue } from "../hooks/useAutoCloseQueue";

interface SignResultProps {
  status?: "success" | "error";
}

export function SignResult(props: SignResultProps) {
  const isSuccess = () => (props.status ?? "success") === "success";

  const stored = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("signResult") ?? "{}");
    } catch {
      return {};
    }
  })();

  const signature = stored.signature as string | undefined;
  const errorMessage = stored.error as string | undefined;

  const { autoCloseIn, queueSize, dismiss } = useAutoCloseQueue({ skip: !isSuccess() });

  onCleanup(() => sessionStorage.removeItem("signResult"));

  return (
    <div class="flex flex-col items-center justify-center h-[600px] px-4">
      <div
        class={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${isSuccess() ? "bg-success/10" : "bg-danger/10"}`}
      >
        <Show when={isSuccess()} fallback={<XCircle size={40} class="text-danger" />}>
          <CheckCircle2 size={40} class="text-success" />
        </Show>
      </div>

      <h1 class="text-xl font-semibold text-text-primary mb-1">
        {isSuccess() ? "Message Signed" : "Signing Failed"}
      </h1>
      <p class="text-sm text-text-secondary text-center mb-6">
        {isSuccess()
          ? "The message has been signed successfully."
          : "Something went wrong. The message was not signed."}
      </p>

      <Show when={isSuccess() && signature}>
        <Card class="w-full mb-6">
          <div class="flex items-center justify-between mb-1.5">
            <p class="text-xs text-text-secondary">Signature</p>
            <CopyButton text={signature!} size={14} />
          </div>
          <p class="font-mono text-[10px] text-text-primary leading-relaxed break-all">
            {signature}
          </p>
        </Card>
      </Show>

      <Show when={!isSuccess()}>
        <Card class="w-full mb-6">
          <p class="text-xs text-text-secondary mb-1">Error</p>
          <p class="font-mono text-xs text-danger leading-relaxed">
            {errorMessage ?? "User rejected the signing request"}
          </p>
        </Card>
      </Show>

      <div class="w-full space-y-2">
        <Button onClick={dismiss} size="lg">
          Done
        </Button>
        <Show when={queueSize() > 0}>
          <p class="text-xs text-text-tertiary text-center">
            {queueSize()} pending request{queueSize() > 1 ? "s" : ""} remaining
            {autoCloseIn() != null && ` · next in ${autoCloseIn()}s`}
          </p>
        </Show>
      </div>
    </div>
  );
}
