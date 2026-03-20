import { ComponentChildren } from "preact";
import { AlertTriangle, Info, AlertCircle } from "lucide-preact";

type BannerVariant = "info" | "warning" | "danger";

interface BannerProps {
  children: ComponentChildren;
  variant?: BannerVariant;
  class?: string;
}

const variantConfig: Record<BannerVariant, { bg: string; text: string; icon: typeof Info }> = {
  info: { bg: "bg-accent-light", text: "text-accent", icon: Info },
  warning: { bg: "bg-warning-bg", text: "text-warning-text", icon: AlertTriangle },
  danger: { bg: "bg-danger-bg", text: "text-danger", icon: AlertCircle },
};

export function Banner({ children, variant = "info", class: cls = "" }: BannerProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div class={`flex items-start gap-2.5 p-3 rounded-[var(--radius-card)] ${config.bg} ${cls}`}>
      <Icon size={18} class={`${config.text} shrink-0 mt-0.5`} />
      <p class={`text-sm leading-snug ${config.text}`}>{children}</p>
    </div>
  );
}
