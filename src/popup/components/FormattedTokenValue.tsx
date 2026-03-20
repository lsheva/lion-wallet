import { getTokenValueDisplay } from "@shared/format";

interface FormattedTokenValueProps {
  value: string | number;
  class?: string;
}

/** Renders token amounts; uses HTML `<sub>` for runs of leading fractional zeros. */
export function FormattedTokenValue({ value, class: className }: FormattedTokenValueProps) {
  const { pieces } = getTokenValueDisplay(value);
  return (
    <span class={className}>
      {pieces.map((p, i) =>
        p.kind === "text" ? (
          p.text
        ) : (
          <sub key={i} class="text-[0.75em] leading-none">
            {p.text}
          </sub>
        ),
      )}
    </span>
  );
}
