import { ChevronDown } from "lucide-preact";
import { activeNetwork, showNetworkSelector } from "../store";
import { ChainIcon } from "./ChainIcon";

interface NetworkBadgeProps {
  clickable?: boolean;
  class?: string;
}

export function NetworkBadge({ clickable = true, class: cls = "" }: NetworkBadgeProps) {
  const network = activeNetwork.value;
  const isTestnet = !!network.chain.testnet;

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
      style={
        !isTestnet ? { backgroundColor: `${network.color}18`, color: network.color } : undefined
      }
    >
      <ChainIcon chainId={network.chain.id} size={14} />
      <span class="truncate max-w-[140px]">{network.chain.name}</span>
      {clickable && (
        <ChevronDown
          size={14}
          class={`shrink-0 ${isTestnet ? "text-text-tertiary" : ""}`}
          style={!isTestnet ? { color: network.color, opacity: 0.6 } : undefined}
        />
      )}
    </button>
  );
}
