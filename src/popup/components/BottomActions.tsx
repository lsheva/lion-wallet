import type { JSX } from "solid-js";

interface BottomActionsProps {
  children: JSX.Element;
  class?: string;
}

export function BottomActions(props: BottomActionsProps) {
  return (
    <div
      class={`sticky bottom-0 px-4 py-3 bg-base/80 backdrop-blur-sm border-t border-divider ${props.class ?? ""}`}
    >
      <div class="flex gap-3">{props.children}</div>
    </div>
  );
}
