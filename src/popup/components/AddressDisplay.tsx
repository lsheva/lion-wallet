import { truncateAddress } from "@shared/format";
import { mergeProps } from "solid-js";
import { CopyButton } from "./CopyButton";

interface AddressDisplayProps {
  address: string;
  full?: boolean;
  class?: string;
}

export function AddressDisplay(rawProps: AddressDisplayProps) {
  const props = mergeProps({ full: false, class: "" }, rawProps);
  return (
    <span class={`inline-flex items-center gap-1 ${props.class}`}>
      <span
        class={`font-mono text-text-secondary ${props.full ? "text-[10px] leading-tight" : "text-sm"}`}
      >
        {props.full ? props.address : truncateAddress(props.address)}
      </span>
      <CopyButton text={props.address} size={14} />
    </span>
  );
}
