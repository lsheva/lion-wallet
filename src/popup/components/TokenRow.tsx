import { Fuel } from "lucide-preact";
import type { Token } from "../store";
import { ChainIcon } from "./ChainIcon";
import { FormattedTokenValue } from "./FormattedTokenValue";

interface TokenRowProps {
  token: Token;
  chainId: number;
  onClick?: () => void;
}

/** Split at the last space so the final word + gas icon can sit in one nowrap run. */
function splitNameForGasLabel(name: string): { before: string; last: string } {
  const t = name.trimEnd();
  if (!t) return { before: "", last: "" };
  const i = t.lastIndexOf(" ");
  if (i === -1) return { before: "", last: t };
  return { before: t.slice(0, i + 1), last: t.slice(i + 1) };
}

export function TokenRow({ token, chainId, onClick }: TokenRowProps) {
  const isNative = !token.address;
  const gasNameParts = isNative ? splitNameForGasLabel(token.name) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      class="flex items-start w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left"
    >
      {isNative ? (
        <div class="shrink-0 pt-0.5">
          <ChainIcon chainId={chainId} size={32} />
        </div>
      ) : (
        <div class="shrink-0 pt-0.5">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: token.color }}
          >
            {token.symbol.slice(0, 1)}
          </div>
        </div>
      )}
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
            <span class="break-words [overflow-wrap:anywhere]">{token.name}</span>
          )}
        </p>
      </div>
      <div class="text-right shrink-0 ml-2 pt-0.5">
        <p class="text-sm font-mono font-medium text-text-primary">
          <FormattedTokenValue value={token.balance} />{" "}
          <span class="text-text-secondary text-xs">{token.symbol}</span>
        </p>
        {token.usdValue && <p class="text-xs text-text-secondary">{token.usdValue}</p>}
      </div>
    </button>
  );
}
