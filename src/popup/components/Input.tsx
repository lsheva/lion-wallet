import { Eye, EyeOff } from "lucide-solid";
import { createSignal, type JSX, Show } from "solid-js";

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onInput?: (value: string) => void;
  type?: "text" | "password";
  mono?: boolean;
  error?: string;
  rightSlot?: JSX.Element;
  multiline?: boolean;
  rows?: number;
  autoFocus?: boolean;
  class?: string;
}

let idCounter = 0;

export function Input(props: InputProps) {
  const [showPassword, setShowPassword] = createSignal(false);
  const inputId = `input-${++idCounter}`;

  const focusRef = (el: HTMLElement) => {
    if (props.autoFocus) el.focus();
  };

  const isPassword = () => (props.type ?? "text") === "password";
  const inputType = () =>
    isPassword() ? (showPassword() ? "text" : "password") : (props.type ?? "text");

  const inputClass = () => `
    w-full bg-surface rounded-[var(--radius-card)] px-3 py-2.5
    text-text-primary text-base
    placeholder:text-text-tertiary
    outline-none ring-1 ring-transparent
    focus:ring-accent/40 focus:ring-2
    transition-shadow duration-150
    ${props.mono ? "font-mono text-sm" : ""}
    ${props.error ? "ring-danger ring-1" : ""}
    ${props.rightSlot || isPassword() ? "pr-10" : ""}
  `;

  return (
    <div class={`space-y-1.5 ${props.class ?? ""}`}>
      <Show when={props.label}>
        <label for={inputId} class="block text-sm font-medium text-text-secondary">
          {props.label}
        </label>
      </Show>
      <div class="relative">
        <Show
          when={props.multiline}
          fallback={
            <input
              id={inputId}
              ref={focusRef}
              class={inputClass()}
              type={inputType()}
              placeholder={props.placeholder}
              value={props.value}
              onInput={(e) => props.onInput?.(e.currentTarget.value)}
            />
          }
        >
          <textarea
            id={inputId}
            ref={focusRef}
            class={`${inputClass()} resize-none`}
            placeholder={props.placeholder}
            value={props.value}
            rows={props.rows ?? 4}
            onInput={(e) => props.onInput?.(e.currentTarget.value)}
          />
        </Show>
        <Show when={isPassword()}>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword())}
            aria-label={showPassword() ? "Hide password" : "Show password"}
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
          >
            <Show when={showPassword()} fallback={<Eye size={18} />}>
              <EyeOff size={18} />
            </Show>
          </button>
        </Show>
        <Show when={props.rightSlot && !isPassword()}>
          <div class="absolute right-2.5 top-1/2 -translate-y-1/2">{props.rightSlot}</div>
        </Show>
      </div>
      <Show when={props.error}>
        <p class="text-xs text-danger">{props.error}</p>
      </Show>
    </div>
  );
}
