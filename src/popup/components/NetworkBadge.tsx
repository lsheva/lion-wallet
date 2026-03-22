import { ChevronDown } from "lucide-solid";
import { Show } from "solid-js";
import { activeNetwork, chainColor, setShowNetworkSelector } from "../store";
import { ChainIcon } from "./ChainIcon";

interface NetworkBadgeProps {
  clickable?: boolean;
  class?: string;
}

export function NetworkBadge(props: NetworkBadgeProps) {
  const clickable = () => props.clickable ?? true;

  return (
    <button
      type="button"
      onClick={clickable() ? () => setShowNetworkSelector(true) : undefined}
      aria-label={
        clickable()
          ? `Network: ${activeNetwork().name}. Click to change`
          : `Network: ${activeNetwork().name}`
      }
      class={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        text-sm font-medium transition-colors
        ${activeNetwork().testnet ? "bg-surface text-text-secondary" : "bg-surface text-text-primary"}
        ${clickable() ? "hover:bg-divider cursor-pointer" : ""}
        ${props.class ?? ""}
      `}
      style={
        !activeNetwork().testnet
          ? { "background-color": `${chainColor(activeNetwork().id)}25` }
          : undefined
      }
    >
      <ChainIcon chainId={activeNetwork().id} size={14} />
      <span class="truncate max-w-[140px] text-text-primary">{activeNetwork().name}</span>
      <Show when={clickable()}>
        <ChevronDown size={14} class="shrink-0 text-text-tertiary" />
      </Show>
    </button>
  );
}
