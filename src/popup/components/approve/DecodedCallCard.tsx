import { truncateAddress } from "@shared/format";
import type { DecodedCall } from "@shared/types";
import { ChevronDown, ChevronUp, FileCode } from "lucide-solid";
import { For, Show } from "solid-js";
import { Card } from "../Card";
import { CopyButton } from "../CopyButton";
import { scrollEndIntoView } from "./helpers";

const COLLAPSED_ARGS = 3;

function formatArgValue(value: string, type: string): string {
  if (type === "address") return `${value.slice(0, 6)}...${value.slice(-4)}`;
  if (value.length > 12) return `${value.slice(0, 8)}...${value.slice(-4)}`;
  return value;
}

export function DecodedCallCard(props: {
  decoded: DecodedCall;
  toAddress: string;
  argsExpanded: boolean;
  setArgsExpanded: (v: boolean) => void;
}) {
  let argsEl: HTMLButtonElement | undefined;

  return (
    <Card>
      <p class="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-2.5">
        Contract Action
      </p>
      <div class="space-y-2.5">
        <div class="flex items-center gap-2">
          <FileCode size={16} class="text-accent shrink-0" />
          <p class="font-mono text-sm font-semibold text-accent truncate">
            {props.decoded.functionName}()
          </p>
        </div>

        <Show when={props.decoded.args.length > 0}>
          <button
            type="button"
            ref={argsEl}
            class="bg-base rounded-[var(--radius-chip)] divide-y divide-divider cursor-pointer w-full text-left"
            onClick={() => {
              const expanding = !props.argsExpanded;
              props.setArgsExpanded(expanding);
              if (expanding) scrollEndIntoView(argsEl);
            }}
          >
            <For
              each={
                props.argsExpanded
                  ? props.decoded.args
                  : props.decoded.args.slice(0, COLLAPSED_ARGS)
              }
            >
              {(arg) => (
                <div class="flex items-center justify-between px-3 py-2">
                  <span class="text-xs text-text-secondary shrink-0">{arg.name}</span>
                  <span class="font-mono text-xs text-text-primary text-right">
                    {formatArgValue(arg.value, arg.type)}
                  </span>
                </div>
              )}
            </For>
            <Show when={props.decoded.args.length > COLLAPSED_ARGS}>
              <div class="flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] text-accent">
                <Show
                  when={props.argsExpanded}
                  fallback={
                    <>
                      <ChevronDown size={12} /> {props.decoded.args.length - COLLAPSED_ARGS} more
                    </>
                  }
                >
                  <ChevronUp size={12} /> Show less
                </Show>
              </div>
            </Show>
          </button>
        </Show>

        <div class="flex items-center justify-between pt-1.5 border-t border-divider">
          <span class="text-xs text-text-secondary">Interacting with</span>
          <span class="inline-flex items-center gap-1 font-mono text-xs text-text-primary">
            {props.decoded.contractName ? (
              <>
                {props.decoded.contractName}{" "}
                <span class="text-text-tertiary">({truncateAddress(props.toAddress)})</span>
              </>
            ) : (
              truncateAddress(props.toAddress)
            )}
            <CopyButton text={props.toAddress} size={12} />
          </span>
        </div>
      </div>
    </Card>
  );
}
