/**
 * Single account row used inside the Wallets-and-Accounts list. Clicking the
 * row switches the active account; the inline `(i)` button opens the
 * per-account info modal.
 */
import { truncateAddress } from "@shared/format";
import type { SerializedAccount } from "@shared/types";
import { Info } from "lucide-solid";
import { Show } from "solid-js";
import { CopyButton } from "../../components/CopyButton";
import { Identicon } from "../../components/Identicon";
import { walletState } from "../../store";

export function AccountRow(props: {
  acc: SerializedAccount;
  accountArrayIndex: number;
  isActive: boolean;
  onOpenInfo: () => void;
}) {
  return (
    <div
      class={`flex items-center gap-1 w-full pl-8 pr-4 py-2.5 hover:bg-base/50 transition-colors
        ${props.isActive ? "bg-accent-light/80" : ""}`}
    >
      {/** biome-ignore lint/a11y/useSemanticElements: inner button cannot nest inside <button> */}
      <div
        onClick={() => walletState.switchAccount(props.accountArrayIndex)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            walletState.switchAccount(props.accountArrayIndex);
          }
        }}
        class="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer"
        role="button"
        tabIndex={0}
      >
        <Identicon address={props.acc.address} size={28} />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 min-w-0">
            <p class="text-sm font-semibold text-text-primary">{props.acc.name}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onOpenInfo();
              }}
              class="p-0.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer shrink-0"
              aria-label="Account details"
            >
              <Info size={12} />
            </button>
          </div>

          <div class="flex items-center gap-1 mt-0.5">
            <span class="text-[11px] font-mono font-medium text-text-primary/70 truncate">
              {truncateAddress(props.acc.address)}
            </span>
            <CopyButton text={props.acc.address} size={12} />
          </div>
        </div>
      </div>

      <Show when={props.isActive}>
        <div class="w-2 h-2 rounded-full bg-accent shrink-0" />
      </Show>
    </div>
  );
}
