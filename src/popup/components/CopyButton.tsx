import { Check, Copy } from "lucide-preact";
import type { JSX } from "preact";
import { useState } from "preact/hooks";

interface CopyButtonProps {
  text: string;
  size?: number;
  class?: string;
}

export function CopyButton({ text, size = 16, class: cls = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      class={`p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer ${cls}`}
    >
      {copied ? <Check size={size} class="text-success" /> : <Copy size={size} />}
    </button>
  );
}
