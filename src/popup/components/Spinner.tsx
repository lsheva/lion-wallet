import { Loader2 } from "lucide-solid";

interface SpinnerProps {
  size?: "sm" | "md";
  class?: string;
}

export function Spinner(props: SpinnerProps) {
  const px = () => ((props.size ?? "md") === "sm" ? 16 : 24);
  return <Loader2 size={px()} class={`animate-spin text-accent ${props.class ?? ""}`} />;
}
