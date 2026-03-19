import { CopyButton } from "./CopyButton";

interface AddressDisplayProps {
  address: string;
  full?: boolean;
  class?: string;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AddressDisplay({ address, full = false, class: cls = "" }: AddressDisplayProps) {
  return (
    <span class={`inline-flex items-center gap-1 ${cls}`}>
      <span class={`font-mono text-text-secondary ${full ? "text-[10px] leading-tight" : "text-sm"}`}>
        {full ? address : truncateAddress(address)}
      </span>
      <CopyButton text={address} size={14} />
    </span>
  );
}
