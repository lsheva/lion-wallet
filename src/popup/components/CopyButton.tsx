import { Check, Copy } from "lucide-solid";
import { createSignal, Show } from "solid-js";

interface CopyButtonProps {
  text: string;
  size?: number;
  class?: string;
}

export function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async (e: MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(props.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied() ? "Copied" : "Copy to clipboard"}
      class={`p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer ${props.class ?? ""}`}
    >
      <Show when={copied()} fallback={<Copy size={props.size ?? 16} />}>
        <Check size={props.size ?? 16} class="text-success" />
      </Show>
    </button>
  );
}
