import { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { X } from "lucide-preact";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ComponentChildren;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div class="absolute inset-0 z-40 flex items-end">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div class="relative w-full bg-surface rounded-t-2xl shadow-lg animate-slide-up max-h-[85%] flex flex-col">
        {title && (
          <div class="flex items-center justify-between px-4 py-3 border-b border-divider shrink-0">
            <h2 class="text-base font-semibold text-text-primary">{title}</h2>
            <button onClick={onClose} class="p-1 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>
        )}
        <div class="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
