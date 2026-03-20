import type { ComponentChildren } from "preact";

interface CardProps {
  children: ComponentChildren;
  header?: string;
  class?: string;
  padding?: boolean;
}

export function Card({ children, header, class: cls = "", padding = true }: CardProps) {
  return (
    <div class={`bg-surface rounded-[var(--radius-card)] shadow-sm ${cls}`}>
      {header && (
        <div class="px-4 pt-3 pb-1">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {header}
          </h3>
        </div>
      )}
      {padding ? <div class="px-4 py-3">{children}</div> : children}
    </div>
  );
}
