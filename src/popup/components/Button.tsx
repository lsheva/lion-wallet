import { ComponentChildren } from "preact";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  children: ComponentChildren;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  class?: string;
  type?: "button" | "submit";
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "bg-divider text-text-primary hover:bg-divider-strong",
  ghost: "bg-transparent text-text-secondary hover:bg-divider",
  danger: "bg-danger text-white hover:bg-danger-hover",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-base",
  lg: "px-5 py-3 text-base font-medium",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = true,
  onClick,
  class: cls = "",
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      class={`
        inline-flex items-center justify-center gap-2
        rounded-[var(--radius-btn)] font-medium
        transition-all duration-150
        active:scale-[0.97]
        disabled:opacity-50 disabled:pointer-events-none
        cursor-pointer
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? "w-full" : ""}
        ${cls}
      `}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
