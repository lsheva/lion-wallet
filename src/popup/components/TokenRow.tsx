import { Fuel, X } from "lucide-solid";
import { Show } from "solid-js";
import type { Token } from "../store";
import { ChainIcon } from "./ChainIcon";
import { FormattedTokenValue } from "./FormattedTokenValue";
import { TokenImage } from "./TokenImage";

interface TokenRowProps {
  token: Token;
  chainId: number;
  onClick?: () => void;
  managing?: boolean;
  canHide?: boolean;
  onHide?: () => void;
}

/** Split at the last space so the final word + gas icon can sit in one nowrap run. */
function splitNameForGasLabel(name: string): { before: string; last: string } {
  const t = name.trimEnd();
  if (!t) return { before: "", last: "" };
  const i = t.lastIndexOf(" ");
  if (i === -1) return { before: "", last: t };
  return { before: t.slice(0, i + 1), last: t.slice(i + 1) };
}

export function TokenRow(props: TokenRowProps) {
  const isNative = !props.token.address;
  const gasNameParts = isNative ? splitNameForGasLabel(props.token.name) : null;

  return (
    <div class="flex items-center w-full px-4 py-3 hover:bg-base/50 transition-colors text-left">
      <Show when={props.managing && props.canHide}>
        <button
          type="button"
          onClick={() => props.onHide?.()}
          aria-label={`Hide ${props.token.symbol}`}
          class="shrink-0 mr-2 p-1 rounded-full text-text-tertiary hover:text-danger hover:bg-danger/15 transition-colors cursor-pointer"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </Show>
      <button
        type="button"
        onClick={props.onClick}
        class="flex items-center flex-1 min-w-0 cursor-pointer text-left"
      >
        <div class="shrink-0 flex items-center justify-center w-8 h-8">
          <Show
            when={isNative}
            fallback={
              <TokenImage
                address={props.token.address}
                chainId={props.chainId}
                symbol={props.token.symbol}
                color={props.token.color}
                size={32}
              />
            }
          >
            <ChainIcon chainId={props.chainId} size={32} />
          </Show>
        </div>
        <div class="ml-2 flex-1 min-w-0">
          <p class="text-sm font-medium text-text-primary leading-snug min-w-0 m-0">
            {gasNameParts ? (
              <>
                {gasNameParts.before ? (
                  <span class="break-words [overflow-wrap:anywhere]">{gasNameParts.before}</span>
                ) : null}
                <span class="break-words [overflow-wrap:anywhere]">
                  {gasNameParts.last}
                  <span class="whitespace-nowrap">
                    {"\u00A0"}
                    <Fuel
                      size={12}
                      class="inline-block align-middle -translate-y-px text-text-tertiary"
                      aria-hidden
                    />
                  </span>
                </span>
              </>
            ) : (
              <span class="break-words [overflow-wrap:anywhere]">{props.token.name}</span>
            )}
          </p>
        </div>
        <div class="text-right shrink-0 ml-2">
          <p class="text-sm font-mono font-medium text-text-primary">
            <FormattedTokenValue value={props.token.balance} />{" "}
            <span class="text-text-secondary text-xs">{props.token.symbol}</span>
          </p>
          <Show when={props.token.usdValue}>
            <p class="text-xs text-text-secondary">{props.token.usdValue}</p>
          </Show>
        </div>
      </button>
    </div>
  );
}
