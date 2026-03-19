import { ChevronDown } from "lucide-preact";
import { activeNetwork, showNetworkSelector } from "../store";

interface NetworkBadgeProps {
  clickable?: boolean;
  class?: string;
}

export function NetworkBadge({ clickable = true, class: cls = "" }: NetworkBadgeProps) {
  const network = activeNetwork.value;

  return (
    <button
      onClick={clickable ? () => (showNetworkSelector.value = true) : undefined}
      class={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        bg-surface text-sm font-medium text-text-primary
        ${clickable ? "hover:bg-divider cursor-pointer" : ""}
        transition-colors ${cls}
      `}
    >
      <span class="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: network.color }} />
      <span class="truncate max-w-[100px]">{network.name}</span>
      {clickable && <ChevronDown size={14} class="text-text-tertiary shrink-0" />}
    </button>
  );
}
