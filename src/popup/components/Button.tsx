import { type JSX, mergeProps, Show } from "solid-js";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  children: JSX.Element;
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

export function Button(rawProps: ButtonProps) {
  const props = mergeProps(
    {
      variant: "primary" as Variant,
      size: "md" as Size,
      loading: false,
      disabled: false,
      fullWidth: true,
      type: "button" as const,
      class: "",
    },
    rawProps,
  );
  return (
    <button
      type={props.type}
      disabled={props.disabled || props.loading}
      onClick={props.onClick}
      class={`
        inline-flex items-center justify-center gap-2
        rounded-[var(--radius-btn)] font-medium
        transition-all duration-150
        active:scale-[0.97]
        disabled:opacity-50 disabled:pointer-events-none
        cursor-pointer
        ${variantStyles[props.variant]}
        ${sizeStyles[props.size]}
        ${props.fullWidth ? "w-full" : ""}
        ${props.class}
      `}
    >
      <Show when={props.loading}>
        <Spinner size="sm" />
      </Show>
      {props.children}
    </button>
  );
}
