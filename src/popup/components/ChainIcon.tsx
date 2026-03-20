import { NETWORK_BY_ID } from "@shared/constants";
import { CHAIN_ICON_BY_ID } from "../chain-icons";

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

  const network = NETWORK_BY_ID.get(chainId);
  const label = network?.chain.name?.[0] ?? "?";

  return (
    <span
      class={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ${cls}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        backgroundColor: network?.color ?? "#8E8E93",
      }}
    >
      {label}
    </span>
  );
}
