import { Eye, EyeOff } from "lucide-preact";
import type { ComponentChildren, RefCallback } from "preact";
import { useState } from "preact/hooks";

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onInput?: (value: string) => void;
  type?: "text" | "password";
  mono?: boolean;
  error?: string;
  rightSlot?: ComponentChildren;
  multiline?: boolean;
  rows?: number;
  autoFocus?: boolean;
  class?: string;
}

let idCounter = 0;

export function Input({
  label,
  placeholder,
  value,
  onInput,
  type = "text",
  mono = false,
  error,
  rightSlot,
  multiline = false,
  rows = 4,
  autoFocus = false,
  class: cls = "",
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;
  const [inputId] = useState(() => `input-${++idCounter}`);

  const focusRef: RefCallback<HTMLElement> = (el) => {
    if (autoFocus && el) el.focus();
  };

  const inputClass = `
    w-full bg-surface rounded-[var(--radius-card)] px-3 py-2.5
    text-text-primary text-base
    placeholder:text-text-tertiary
    outline-none ring-1 ring-transparent
    focus:ring-accent/40 focus:ring-2
    transition-shadow duration-150
    ${mono ? "font-mono text-sm" : ""}
    ${error ? "ring-danger ring-1" : ""}
    ${rightSlot || isPassword ? "pr-10" : ""}
  `;

  return (
    <div class={`space-y-1.5 ${cls}`}>
      {label && (
        <label htmlFor={inputId} class="block text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div class="relative">
        {multiline ? (
          <textarea
            id={inputId}
            ref={focusRef}
            class={`${inputClass} resize-none`}
            placeholder={placeholder}
            value={value}
            rows={rows}
            onInput={(e) => onInput?.((e.target as HTMLTextAreaElement).value)}
          />
        ) : (
          <input
            id={inputId}
            ref={focusRef}
            class={inputClass}
            type={inputType}
            placeholder={placeholder}
            value={value}
            onInput={(e) => onInput?.((e.target as HTMLInputElement).value)}
          />
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        {rightSlot && !isPassword && (
          <div class="absolute right-2.5 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
      {error && <p class="text-xs text-danger">{error}</p>}
    </div>
  );
}
