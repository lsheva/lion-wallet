import { getTokenValueDisplay } from "@shared/format";
import { For } from "solid-js";

interface FormattedTokenValueProps {
  value: string | number;
  class?: string;
}

/** Renders token amounts; uses HTML `<sub>` for runs of leading fractional zeros. */
export function FormattedTokenValue(props: FormattedTokenValueProps) {
  const display = () => getTokenValueDisplay(props.value);
  return (
    <span class={props.class}>
      <For each={display().pieces}>
        {(p) =>
          p.kind === "text" ? p.text : <sub class="text-[0.75em] leading-none">{p.text}</sub>
        }
      </For>
    </span>
  );
}
