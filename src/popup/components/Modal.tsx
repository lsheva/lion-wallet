import { X } from "lucide-solid";
import { createEffect, type JSX, onCleanup, Show } from "solid-js";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: JSX.Element;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

export function Modal(props: ModalProps) {
  let containerRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (!props.open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onClose();
        return;
      }
      if (e.key === "Tab" && containerRef) {
        const focusable = Array.from(containerRef.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handler);

    requestAnimationFrame(() => {
      const first = containerRef?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });

    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  return (
    <Show when={props.open}>
      <div
        class="absolute inset-0 z-40 flex items-end"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close dialog"
          class="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in border-none cursor-default w-full"
          onClick={props.onClose}
        />
        <div
          ref={containerRef}
          class="relative w-full bg-surface rounded-t-2xl shadow-lg animate-slide-up max-h-[85%] flex flex-col"
        >
          <Show when={props.title}>
            <div class="flex items-center justify-between px-4 py-3 border-b border-divider shrink-0">
              <h2 class="text-base font-semibold text-text-primary">{props.title}</h2>
              <button
                type="button"
                onClick={props.onClose}
                aria-label="Close"
                class="p-1 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </Show>
          <div class="overflow-y-auto flex-1">{props.children}</div>
        </div>
      </div>
    </Show>
  );
}
