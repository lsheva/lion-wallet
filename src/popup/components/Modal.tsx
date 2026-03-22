import { X } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ComponentChildren;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && containerRef.current) {
        const focusable = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        );
        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

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
      const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });

    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div class="absolute inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        class="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in border-none cursor-default w-full"
        onClick={onClose}
      />
      <div
        ref={containerRef}
        class="relative w-full bg-surface rounded-t-2xl shadow-lg animate-slide-up max-h-[85%] flex flex-col"
      >
        {title && (
          <div class="flex items-center justify-between px-4 py-3 border-b border-divider shrink-0">
            <h2 class="text-base font-semibold text-text-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              class="p-1 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div class="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
