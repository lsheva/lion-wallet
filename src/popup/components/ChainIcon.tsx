import { CHAIN_BY_ID } from "@shared/constants";
import { Show } from "solid-js";
import { CHAIN_COLOR_BY_ID, CHAIN_ICON_BY_ID } from "../chain-ui.generated";

interface ChainIconProps {
  chainId: number;
  size?: number;
  class?: string;
}

export function ChainIcon(props: ChainIconProps) {
  const size = () => props.size ?? 16;
  const svg = () => CHAIN_ICON_BY_ID.get(props.chainId);

  return (
    <Show
      when={svg()}
      fallback={
        <span
          class={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ${props.class ?? ""}`}
          style={{
            width: `${size()}px`,
            height: `${size()}px`,
            "font-size": `${size() * 0.5}px`,
            "background-color": CHAIN_COLOR_BY_ID.get(props.chainId) ?? "#8E8E93",
          }}
        >
          {CHAIN_BY_ID.get(props.chainId)?.name?.[0] ?? "?"}
        </span>
      }
    >
      <span
        class={`inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full ${props.class ?? ""}`}
        style={{ width: `${size()}px`, height: `${size()}px` }}
        innerHTML={svg()}
      />
    </Show>
  );
}
