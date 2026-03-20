import { Fuel } from "lucide-preact";
import { activeNetwork, type Token } from "../store";
import { FormattedTokenValue } from "./FormattedTokenValue";
import { ChainIcon } from "./ChainIcon";

interface TokenRowProps {
  token: Token;
  onClick?: () => void;
}

export function TokenRow({ token, onClick }: TokenRowProps) {
  const isNative = !token.address;

  return (
    <button
      type="button"
      onClick={onClick}
      class="flex items-center w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left"
    >
      {isNative ? (
        <ChainIcon chainId={activeNetwork.value.chain.id} size={32} />
      ) : (
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ backgroundColor: token.color }}
        >
          {token.symbol.slice(0, 1)}
        </div>
      )}
      <div class="ml-2 flex-1 min-w-0">
        <div class="flex items-center gap-1">
          <p class="text-xs font-medium text-text-primary truncate">{token.name}</p>
          {isNative && (
            <Fuel size={10} class="text-text-tertiary shrink-0" />
          )}
        </div>
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
