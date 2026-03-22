import { Fuel } from "lucide-preact";
import type { Token } from "../store";
import { ChainIcon } from "./ChainIcon";
import { FormattedTokenValue } from "./FormattedTokenValue";
import { TokenImage } from "./TokenImage";

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
      class="flex items-center w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left"
    >
      <div class="shrink-0 flex items-center justify-center w-8 h-8">
        {isNative ? (
          <ChainIcon chainId={chainId} size={32} />
        ) : (
          <TokenImage
            address={token.address}
            chainId={chainId}
            symbol={token.symbol}
            color={token.color}
            size={32}
          />
        )}
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
            <span class="break-words [overflow-wrap:anywhere]">{token.name}</span>
          )}
        </p>
      </div>
      <div class="text-right shrink-0 ml-2">
        <p class="text-sm font-mono font-medium text-text-primary">
          <FormattedTokenValue value={token.balance} />{" "}
          <span class="text-text-secondary text-xs">{token.symbol}</span>
        </p>
        {token.usdValue && <p class="text-xs text-text-secondary">{token.usdValue}</p>}
      </div>
    </button>
  );
}
