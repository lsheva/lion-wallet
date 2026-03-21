import { ChevronDown } from "lucide-preact";
import { activeNetwork, chainColor, showNetworkSelector } from "../store";
import { ChainIcon } from "./ChainIcon";

interface NetworkBadgeProps {
  clickable?: boolean;
  class?: string;
}

export function NetworkBadge({ clickable = true, class: cls = "" }: NetworkBadgeProps) {
  const network = activeNetwork.value;
  const isTestnet = !!network.testnet;
  const color = chainColor(network.id);

  return (
    <button
      type="button"
      onClick={clickable ? () => (showNetworkSelector.value = true) : undefined}
      class={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        text-sm font-medium transition-colors
        ${isTestnet ? "bg-surface text-text-secondary" : "bg-surface text-text-primary"}
        ${clickable ? "hover:bg-divider cursor-pointer" : ""}
        ${cls}
      `}
      style={!isTestnet ? { backgroundColor: `${color}18`, color } : undefined}
    >
      <ChainIcon chainId={network.id} size={14} />
      <span class="truncate max-w-[140px]">{network.name}</span>
      {clickable && (
        <ChevronDown
          size={14}
          class={`shrink-0 ${isTestnet ? "text-text-tertiary" : ""}`}
          style={!isTestnet ? { color, opacity: 0.6 } : undefined}
        />
      )}
    </button>
  );
}
