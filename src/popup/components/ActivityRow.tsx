import { truncateAddress } from "@shared/format";
import type { ActivityItem, DecodedEvent } from "@shared/types";
import { ArrowDownLeft, ArrowUpRight, FileCode } from "lucide-preact";
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

export function ActivityRow({ item, userAddress, explorerUrl, nativeSymbol }: ActivityRowProps) {
  const isSent = item.from.toLowerCase() === userAddress.toLowerCase();
  const isContract = !!(item.decoded || item.fn || (item.method && item.method !== "0x"));
  const transfers = item.transfers ?? [];
  const otherEvents = nonTransferEvents(item.events ?? []);

  let label: string;
  let Icon = isSent ? ArrowUpRight : ArrowDownLeft;
  let iconColor = isSent ? "text-danger" : "text-success";

  if (isContract) {
    label = item.decoded?.functionName ?? (item.fn || "Contract Call");
    Icon = FileCode;
    iconColor = "text-accent";
  } else {
    label = isSent ? "Sent" : "Received";
  }

  const counterparty = isSent ? item.to : item.from;
  const ethValue = formatEther(BigInt(item.value || "0"));
  const symbol = nativeSymbol;

  const hasNativeValue = BigInt(item.value || "0") !== 0n;
  const hasBalanceDelta = hasNativeValue || transfers.length > 0;

  return (
    <button
      type="button"
      onClick={() =>
        explorerUrl &&
        item.hash &&
        window.open(`${explorerUrl}/tx/${item.hash}`, "_blank", "noopener")
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
          {item.error && <span class="text-[10px] font-semibold text-danger">Failed</span>}
        </div>
        <div class="flex items-center gap-1 text-xs text-text-tertiary">
          <span class="font-mono">{truncateAddress(counterparty)}</span>
          <span>·</span>
          <span>{relativeTime(item.ts)}</span>
        </div>
        {otherEvents.length > 0 && (
          <div class="flex flex-wrap gap-1 mt-0.5">
            {otherEvents.map((e, i) => (
              <span
                key={i}
                class="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium"
              >
                {e.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {hasBalanceDelta && (
        <div class="text-right shrink-0 flex flex-col items-end gap-0.5">
          {hasNativeValue && (
            <span
              class={`text-[11px] font-mono inline-flex items-baseline flex-wrap justify-end gap-x-0.5 ${isSent ? "text-danger" : "text-success"}`}
            >
              <span>{isSent ? "−" : "+"}</span>
              <FormattedTokenValue value={ethValue} />
              <span>{symbol}</span>
            </span>
          )}
          {transfers.map((t, i) => (
            <span
              key={i}
              class={`text-[11px] font-mono inline-flex items-baseline flex-wrap justify-end gap-x-0.5 ${t.dir === "in" ? "text-success" : "text-danger"}`}
            >
              <span>{t.dir === "in" ? "+" : "−"}</span>
              <FormattedTokenValue value={formatUnits(BigInt(t.amount || "0"), t.decimals)} />
              <span>{t.symbol}</span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
