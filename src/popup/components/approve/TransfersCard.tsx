import type { TokenTransfer } from "@shared/types";
import { ArrowDownLeft, ArrowUpRight } from "lucide-solid";
import { For } from "solid-js";
import { Card } from "../Card";
import { FormattedTokenValue } from "../FormattedTokenValue";

export function TransfersCard(props: { transfers: TokenTransfer[] }) {
  return (
    <Card>
      <p class="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-2">
        Token Transfers
      </p>
      <div class="divide-y divide-divider">
        <For each={props.transfers}>
          {(t) => (
            <div class="flex items-center gap-2.5 py-2">
              <div class="relative">
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ "background-color": t.color }}
                >
                  {t.symbol.slice(0, 1)}
                </div>
                <div
                  class={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${t.direction === "out" ? "bg-danger" : "bg-success"}`}
                >
                  {t.direction === "out" ? (
                    <ArrowUpRight size={9} class="text-white" />
                  ) : (
                    <ArrowDownLeft size={9} class="text-white" />
                  )}
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-text-primary">
                  {t.direction === "out" ? "Send" : "Receive"} {t.symbol}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p
                  class={`font-mono text-sm font-medium inline-flex items-baseline flex-wrap justify-end gap-x-0.5 ${t.direction === "out" ? "text-danger" : "text-success"}`}
                >
                  <span>{t.direction === "out" ? "-" : "+"}</span>
                  <FormattedTokenValue value={t.amount} />
                  <span>{t.symbol}</span>
                </p>
                <p class="text-xs text-text-secondary">{t.usdValue ?? "--"}</p>
              </div>
            </div>
          )}
        </For>
      </div>
    </Card>
  );
}
