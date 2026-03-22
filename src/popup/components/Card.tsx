import { type JSX, Show } from "solid-js";

interface CardProps {
  children: JSX.Element;
  header?: string;
  class?: string;
  padding?: boolean;
}

export function Card(props: CardProps) {
  return (
    <div class={`bg-surface rounded-[var(--radius-card)] shadow-sm ${props.class ?? ""}`}>
      <Show when={props.header}>
        <div class="px-4 pt-3 pb-1">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {props.header}
          </h3>
        </div>
      </Show>
      <Show when={props.padding ?? true} fallback={props.children}>
        <div class="px-4 py-3">{props.children}</div>
      </Show>
    </div>
  );
}
