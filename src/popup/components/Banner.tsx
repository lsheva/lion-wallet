import { AlertCircle, AlertTriangle, Info } from "lucide-solid";
import type { JSX } from "solid-js";

type BannerVariant = "info" | "warning" | "danger";

interface BannerProps {
  children: JSX.Element;
  variant?: BannerVariant;
  class?: string;
}

const variantConfig: Record<BannerVariant, { bg: string; text: string; icon: typeof Info }> = {
  info: { bg: "bg-accent-light", text: "text-accent", icon: Info },
  warning: { bg: "bg-warning-bg", text: "text-warning-text", icon: AlertTriangle },
  danger: { bg: "bg-danger-bg", text: "text-danger", icon: AlertCircle },
};

export function Banner(props: BannerProps) {
  const config = () => variantConfig[props.variant ?? "info"];
  return (
    <div
      role="alert"
      aria-live="polite"
      class={`flex items-start gap-2.5 p-3 rounded-[var(--radius-card)] ${config().bg} ${props.class ?? ""}`}
    >
      {(() => {
        const Icon = config().icon;
        return <Icon size={18} class={`${config().text} shrink-0 mt-0.5`} />;
      })()}
      <p class={`text-sm leading-snug ${config().text}`}>{props.children}</p>
    </div>
  );
}
