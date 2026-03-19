import { useState } from "preact/hooks";
import { route } from "preact-router";
import { Settings, ArrowUpRight, ArrowDownLeft, Plus } from "lucide-preact";
import { Identicon } from "../components/Identicon";
import { AddressDisplay } from "../components/AddressDisplay";
import { NetworkBadge } from "../components/NetworkBadge";
import { TokenRow } from "../components/TokenRow";
import { walletState, showNetworkSelector } from "../mock/state";
import { NetworkSelector } from "./NetworkSelector";
import { AddToken } from "./AddToken";

export function Home() {
  const account = walletState.activeAccount.value;
  const network = walletState.activeNetwork.value;
  const [showAddToken, setShowAddToken] = useState(false);

  return (
    <div class="flex flex-col h-[600px]">
      {/* Header */}
      <div class="flex items-center justify-between px-4 h-12">
        <NetworkBadge />
        <button
          onClick={() => route("/settings")}
          class="p-1.5 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <Settings size={20} />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        {/* Account */}
        <div class="flex flex-col items-center pt-4 pb-3 px-4">
          <Identicon address={account.address} size={48} />
          <div class="mt-2">
            <AddressDisplay address={account.address} />
          </div>
          <p class="text-sm text-text-secondary mt-1">{walletState.totalBalanceUsd.value}</p>
        </div>

        {/* Quick Actions */}
        <div class="flex gap-3 px-6 pb-4">
          <button
            onClick={() => route("/send")}
            class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent text-accent-foreground rounded-full font-medium text-sm hover:bg-accent-hover transition-colors cursor-pointer active:scale-[0.97]"
          >
            <ArrowUpRight size={16} />
            Send
          </button>
          <button
            onClick={() => route("/receive")}
            class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface text-text-primary rounded-full font-medium text-sm shadow-sm hover:bg-divider transition-colors cursor-pointer active:scale-[0.97]"
          >
            <ArrowDownLeft size={16} />
            Receive
          </button>
        </div>

        {/* Tokens */}
        <div class="bg-surface rounded-t-2xl min-h-[200px]">
          <div class="flex items-center justify-between px-4 pt-3 pb-1">
            <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider">Tokens</h3>
            <button
              onClick={() => setShowAddToken(true)}
              class="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              <Plus size={12} />
              Add
            </button>
          </div>
          <div class="divide-y divide-divider">
            {walletState.tokens.value.map((token) => (
              <TokenRow key={token.symbol} token={token} />
            ))}
          </div>
        </div>
      </div>

      {showNetworkSelector.value && <NetworkSelector />}
      <AddToken open={showAddToken} onClose={() => setShowAddToken(false)} />
    </div>
  );
}
