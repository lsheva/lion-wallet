import { ComponentChildren } from "preact";

interface BottomActionsProps {
  children: ComponentChildren;
  class?: string;
}

export function BottomActions({ children, class: cls = "" }: BottomActionsProps) {
  return (
    <div class={`sticky bottom-0 px-4 py-3 bg-base/80 backdrop-blur-sm border-t border-divider ${cls}`}>
      <div class="flex gap-3">
        {children}
      </div>
    </div>
  );
}
