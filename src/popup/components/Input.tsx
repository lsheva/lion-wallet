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
  leftSlot?: JSX.Element;
  rightSlot?: JSX.Element;
  multiline?: boolean;
  /** When multiline, masks characters (e.g. recovery phrase) until revealed by parent. */
  secure?: boolean;
  /** When multiline, e.g. Show + Copy — absolutely positioned bottom-right inside the field. */
  bottomRightSlot?: JSX.Element;
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

  const verticalPad = () => {
    if (props.multiline && props.bottomRightSlot) return "pt-2.5 pb-10";
    return "py-2.5";
  };

  const horizontalPad = () =>
    `${props.leftSlot ? "pl-10" : "pl-3"} ${verticalPad()} ${props.rightSlot || isPassword() ? "pr-10" : "pr-3"}`;

  const inputClass = () => `
    w-full bg-surface rounded-[var(--radius-card)]
    ${horizontalPad()}
    text-text-primary text-base
    placeholder:text-text-tertiary
    outline-none ring-1 transition-shadow duration-150
    ${props.error ? "ring-danger" : "ring-divider"}
    focus:ring-2 focus:ring-accent/40
    ${props.mono ? "font-mono text-sm" : ""}
  `;

  return (
    <div class={`space-y-1.5 ${props.class ?? ""}`}>
      <Show when={props.label}>
        <label for={inputId} class="block text-sm font-medium text-text-secondary">
          {props.label}
        </label>
      </Show>
      <div class="relative">
        <Show when={props.leftSlot}>
          <div
            class={`absolute left-2.5 z-10 [&_button]:cursor-pointer ${
              props.multiline ? "top-2.5" : "top-1/2 -translate-y-1/2"
            }`}
          >
            {props.leftSlot}
          </div>
        </Show>
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
            style={{
              ...(props.secure ? { WebkitTextSecurity: "disc" as const } : {}),
            }}
            onInput={(e) => props.onInput?.(e.currentTarget.value)}
          />
        </Show>
        <Show when={props.multiline && props.bottomRightSlot}>
          <div class="absolute right-2 bottom-2 z-10 flex items-center gap-2.5 text-text-tertiary [&_button]:cursor-pointer">
            {props.bottomRightSlot}
          </div>
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
