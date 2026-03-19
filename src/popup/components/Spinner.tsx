import { Loader2 } from "lucide-preact";

interface SpinnerProps {
  size?: "sm" | "md";
  class?: string;
}

export function Spinner({ size = "md", class: cls = "" }: SpinnerProps) {
  const px = size === "sm" ? 16 : 24;
  return <Loader2 size={px} class={`animate-spin text-accent ${cls}`} />;
}
