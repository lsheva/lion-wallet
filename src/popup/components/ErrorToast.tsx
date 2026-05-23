import { AlertCircle, ChevronDown, X } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { dismissToast, type ToastMessage, toasts } from "../toast";

function ToastItem(props: { toast: ToastMessage }) {
  const [expanded, setExpanded] = createSignal(false);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: handlers only stop propagation; no interactive action
    <div
      role="alert"
      class="bg-elevated rounded-[var(--radius-card)] shadow-lg ring-1 ring-danger/20 animate-slide-up overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div class="flex items-start gap-2 p-3">
        <AlertCircle size={16} class="text-danger shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <p class="text-sm text-text-primary leading-snug">{props.toast.message}</p>
          <Show when={props.toast.details}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded());
              }}
              class="flex items-center gap-1 mt-1.5 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
            >
              <ChevronDown
                size={12}
                class={`transition-transform ${expanded() ? "rotate-180" : ""}`}
              />
              {expanded() ? "Hide details" : "Show details"}
            </button>
          </Show>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismissToast(props.toast.id);
          }}
          class="p-0.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss error"
        >
          <X size={14} />
        </button>
      </div>
      <Show when={expanded() && props.toast.details}>
        <div class="px-3 pb-3">
          <pre class="text-[11px] font-mono text-text-tertiary bg-base rounded-lg p-2 whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
            {props.toast.details}
          </pre>
        </div>
      </Show>
    </div>
  );
}

export function ErrorToast() {
  return (
    <Show when={toasts().length > 0}>
      <div class="absolute top-0 left-0 right-0 z-50 p-3 space-y-2 pointer-events-none">
        <For each={toasts()}>
          {(toast) => (
            <div class="pointer-events-auto">
              <ToastItem toast={toast} />
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
