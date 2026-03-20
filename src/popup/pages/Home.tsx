import { useState, useEffect } from "preact/hooks";
import { route } from "preact-router";
import { Settings, ArrowUpRight, ArrowDownLeft, Plus, Loader2 } from "lucide-preact";
import { Identicon } from "../components/Identicon";
import { AddressDisplay } from "../components/AddressDisplay";
import { NetworkBadge } from "../components/NetworkBadge";
import { TokenRow } from "../components/TokenRow";
import { ActivityRow } from "../components/ActivityRow";
import { FormattedTokenValue } from "../components/FormattedTokenValue";
import { walletState, showNetworkSelector, refreshAll, fetchActivity } from "../store";
import { NetworkSelector } from "./NetworkSelector";
import { AddToken } from "./AddToken";

const PAGE_SIZE = 5;

function ActivitySection({ account }: { account: { address: string } }) {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const items = walletState.activity.value;
  const loading = walletState.activityLoading.value;
  const hasMore = walletState.activityHasMore.value;
  const visible = items.slice(0, displayCount);
  const canShowMore = displayCount < items.length || hasMore;

  const handleLoadMore = async () => {
    if (displayCount < items.length) {
      setDisplayCount((c) => c + PAGE_SIZE);
    } else if (hasMore) {
      await fetchActivity({ loadMore: true });
      setDisplayCount((c) => c + PAGE_SIZE);
    }
  };

  return (
    <div class="bg-surface rounded-2xl mx-4 mb-4">
      <div class="flex items-center gap-2 px-4 pt-3 pb-1">
        <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider">Activity</h3>
        {loading && <Loader2 size={12} class="animate-spin text-text-tertiary" />}
      </div>
      {visible.length > 0 ? (
        <>
          <div class="divide-y divide-divider">
            {visible.map((item) => (
              <ActivityRow key={item.hash} item={item} userAddress={account.address} />
            ))}
          </div>
          {canShowMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loading}
              class="w-full py-2.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load More"}
            </button>
          )}
          {walletState.activitySource.value === "rpc" && (
            <p class="px-4 py-2 text-[10px] text-text-tertiary text-center">
              <button type="button" onClick={() => route("/settings")} class="text-accent hover:text-accent-hover cursor-pointer">
                Add Etherscan key
              </button>{" "}
              for full history.
            </p>
          )}
        </>
      ) : (
        <p class="px-4 py-6 text-sm text-text-tertiary text-center">
          {loading ? "" : "No recent activity"}
        </p>
      )}
    </div>
  );
}

export function Home() {
  const account = walletState.activeAccount.value;
  const [showAddToken, setShowAddToken] = useState(false);

  useEffect(() => {
    refreshAll();
    fetchActivity().catch(() => {});
  }, []);

  return (
    <div class="flex flex-col h-[600px]">
      {/* Header */}
      <div class="flex items-center justify-between px-4 h-12">
        <NetworkBadge />
        <button
          type="button"
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
          <p class="text-sm text-text-secondary mt-1 inline-flex items-baseline flex-wrap justify-center gap-x-1">
            <FormattedTokenValue value={walletState.ethBalance.value} />
            <span>{walletState.activeNetwork.value.chain.nativeCurrency.symbol}</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div class="flex gap-3 px-4 pb-4">
          <button
            type="button"
            onClick={() => route("/send")}
            class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent text-accent-foreground rounded-full font-medium text-sm hover:bg-accent-hover transition-colors cursor-pointer active:scale-[0.97]"
          >
            <ArrowUpRight size={16} />
            Send
          </button>
          <button
            type="button"
            onClick={() => route("/receive")}
            class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface text-text-primary rounded-full font-medium text-sm shadow-sm hover:bg-divider transition-colors cursor-pointer active:scale-[0.97]"
          >
            <ArrowDownLeft size={16} />
            Receive
          </button>
        </div>

        {/* Tokens */}
        <div class="bg-surface rounded-2xl mx-4 mb-3">
          <div class="flex items-center justify-between px-4 pt-3 pb-1">
            <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider">Tokens</h3>
            <button
              type="button"
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

        {/* Activity */}
        <ActivitySection account={account} />
      </div>

      {showNetworkSelector.value && <NetworkSelector />}
      <AddToken open={showAddToken} onClose={() => setShowAddToken(false)} />
    </div>
  );
}
