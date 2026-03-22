import { truncateAddress } from "@shared/format";
import type { ActivityItem, DecodedEvent } from "@shared/types";
import { ArrowDownLeft, ArrowUpRight, FileCode } from "lucide-solid";
import { For, Show } from "solid-js";
import { formatEther, formatUnits } from "viem/utils";
import { FormattedTokenValue } from "./FormattedTokenValue";

interface ActivityRowProps {
  item: ActivityItem;
  userAddress: string;
  explorerUrl?: string;
  nativeSymbol: string;
}

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

const TRANSFER_EVENTS = new Set(["Transfer", "Approval"]);

function nonTransferEvents(events: DecodedEvent[]): DecodedEvent[] {
  return events.filter((e) => !TRANSFER_EVENTS.has(e.name));
}

export function ActivityRow(props: ActivityRowProps) {
  const isSent = props.item.from.toLowerCase() === props.userAddress.toLowerCase();
  const isContract = !!(
    props.item.decoded ||
    props.item.fn ||
    (props.item.method && props.item.method !== "0x")
  );
  const transfers = props.item.transfers ?? [];
  const otherEvents = nonTransferEvents(props.item.events ?? []);

  let label: string;
  let Icon = isSent ? ArrowUpRight : ArrowDownLeft;
  let iconColor = isSent ? "text-danger" : "text-success";

  if (isContract) {
    label = props.item.decoded?.functionName ?? (props.item.fn || "Contract Call");
    Icon = FileCode;
    iconColor = "text-accent";
  } else {
    label = isSent ? "Sent" : "Received";
  }

  const counterparty = isSent ? props.item.to : props.item.from;
  const ethValue = formatEther(BigInt(props.item.value || "0"));
  const symbol = props.nativeSymbol;

  const hasNativeValue = BigInt(props.item.value || "0") !== 0n;
  const hasBalanceDelta = hasNativeValue || transfers.length > 0;

  return (
    <button
      type="button"
      onClick={() =>
        props.explorerUrl &&
        props.item.hash &&
        window.open(`${props.explorerUrl}/tx/${props.item.hash}`, "_blank", "noopener")
      }
      class="flex items-start w-full px-4 py-2.5 hover:bg-base/50 transition-colors cursor-pointer text-left gap-3"
    >
      <div
        class={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconColor} bg-current/8`}
      >
        <Icon size={16} />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-medium text-text-primary">{label}</span>
          <Show when={props.item.error}>
            <span class="text-[10px] font-semibold text-danger">Failed</span>
          </Show>
        </div>
        <div class="flex items-center gap-1 text-xs text-text-tertiary">
          <span class="font-mono">{truncateAddress(counterparty)}</span>
          <span>·</span>
          <span>{relativeTime(props.item.ts)}</span>
        </div>
        <Show when={otherEvents.length > 0}>
          <div class="flex flex-wrap gap-1 mt-0.5">
            <For each={otherEvents}>
              {(e) => (
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                  {e.name}
                </span>
              )}
            </For>
          </div>
        </Show>
      </div>
      <Show when={hasBalanceDelta}>
        <div class="text-right shrink-0 flex flex-col items-end gap-0.5">
          <Show when={hasNativeValue}>
            <span
              class={`text-[11px] font-mono inline-flex items-baseline flex-wrap justify-end gap-x-0.5 ${isSent ? "text-danger" : "text-success"}`}
            >
              <span>{isSent ? "−" : "+"}</span>
              <FormattedTokenValue value={ethValue} />
              <span>{symbol}</span>
            </span>
          </Show>
          <For each={transfers}>
            {(t) => (
              <span
                class={`text-[11px] font-mono inline-flex items-baseline flex-wrap justify-end gap-x-0.5 ${t.dir === "in" ? "text-success" : "text-danger"}`}
              >
                <span>{t.dir === "in" ? "+" : "−"}</span>
                <FormattedTokenValue value={formatUnits(BigInt(t.amount || "0"), t.decimals)} />
                <span>{t.symbol}</span>
              </span>
            )}
          </For>
        </div>
      </Show>
    </button>
  );
}
