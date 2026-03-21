import { CHAIN_BY_ID } from "@shared/constants";
import { CHAIN_COLOR_BY_ID, CHAIN_ICON_BY_ID } from "../chain-ui.generated";

interface ChainIconProps {
  chainId: number;
  size?: number;
  class?: string;
}

export function ChainIcon({ chainId, size = 16, class: cls = "" }: ChainIconProps) {
  const svg = CHAIN_ICON_BY_ID.get(chainId);

  if (svg) {
    return (
      <span
        class={`inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full ${cls}`}
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  const chain = CHAIN_BY_ID.get(chainId);
  const label = chain?.name?.[0] ?? "?";

  return (
    <span
      class={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ${cls}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        backgroundColor: CHAIN_COLOR_BY_ID.get(chainId) ?? "#8E8E93",
      }}
    >
      {label}
    </span>
  );
}
