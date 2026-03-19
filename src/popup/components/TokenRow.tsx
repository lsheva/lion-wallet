import type { Token } from "../mock/data";

interface TokenRowProps {
  token: Token;
  onClick?: () => void;
}

export function TokenRow({ token, onClick }: TokenRowProps) {
  return (
    <button
      onClick={onClick}
      class="flex items-center w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left"
    >
      <div
        class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: token.color }}
      >
        {token.symbol.slice(0, 1)}
      </div>
      <div class="ml-3 flex-1 min-w-0">
        <p class="text-sm font-medium text-text-primary">{token.name}</p>
        <p class="text-xs text-text-secondary">{token.symbol}</p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-sm font-mono font-medium text-text-primary">{token.balance}</p>
        <p class="text-xs text-text-secondary">{token.usdValue}</p>
      </div>
    </button>
  );
}
