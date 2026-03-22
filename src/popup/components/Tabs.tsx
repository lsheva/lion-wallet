import { For } from "solid-js";

interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  class?: string;
}

export function Tabs(props: TabsProps) {
  return (
    <div class={`flex bg-divider rounded-[var(--radius-btn)] p-0.5 ${props.class ?? ""}`}>
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            onClick={() => props.onChange(item.id)}
            class={`
            flex-1 px-3 py-1.5 text-sm font-medium rounded-[7px]
            transition-all duration-150 cursor-pointer
            ${
              props.active === item.id
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }
          `}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
}
