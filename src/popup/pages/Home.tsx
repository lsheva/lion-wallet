import { formatUsd } from "@shared/format";
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus, Settings } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { route } from "preact-router";
import { AccountSwitcher } from "../components/AccountSwitcher";
import { ActivityRow } from "../components/ActivityRow";
import { NetworkBadge } from "../components/NetworkBadge";
import { TokenRow } from "../components/TokenRow";
import { fetchActivity, refreshAll, showNetworkSelector, walletState } from "../store";
import { AddToken } from "./AddToken";
import { NetworkSelector } from "./NetworkSelector";

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
    <div class="bg-surface rounded-2xl w-full">
      <div class="flex items-center gap-2 px-4 pt-3 pb-2">
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
              <button
                type="button"
                onClick={() => route("/settings", true)}
                class="text-accent hover:text-accent-hover cursor-pointer"
              >
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

/** Native-only USD total for the account card (testnet → $0.00). */
function balanceUsdTotal(ethBalance: string, nativeUsdPerUnit: number | null): string {
  const eth = parseFloat(ethBalance);
  if (Number.isNaN(eth)) return "—";
  if (nativeUsdPerUnit === 0) return formatUsd(0);
  if (nativeUsdPerUnit != null && nativeUsdPerUnit > 0) {
    return formatUsd(eth * nativeUsdPerUnit);
  }
  return "—";
}

export function Home() {
  const account = walletState.activeAccount.value;
  const [showAddToken, setShowAddToken] = useState(false);
  const usdTotal = balanceUsdTotal(walletState.ethBalance.value, walletState.nativeUsdPrice.value);

  useEffect(() => {
    refreshAll();
    fetchActivity().catch(() => {});
  }, []);

  return (
    <div class="flex flex-col h-[600px]">
      {/* Header */}
      <header class="shrink-0 flex items-center justify-between px-4 h-12">
        <NetworkBadge />
        <button
          type="button"
          onClick={() => route("/settings", true)}
          class="p-1.5 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Outside scroll so account menu stacks above list; avoids overflow clip */}
      <div class="shrink-0 px-4 pt-3 pb-3">
        <AccountSwitcher usdTotal={usdTotal} />
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        {/* Quick Actions */}
        <div class="flex gap-3 shrink-0">
          <button
            type="button"
            onClick={() => route("/send", true)}
            class="flex-1 flex items-center justify-center py-2.5 bg-accent text-accent-foreground rounded-full font-medium text-sm hover:bg-accent-hover transition-colors cursor-pointer active:scale-[0.97]"
          >
            <span class="inline-flex items-center gap-1.5 -translate-x-1">
              <ArrowUpRight size={16} class="shrink-0" aria-hidden />
              Send
            </span>
          </button>
          <button
            type="button"
            onClick={() => route("/receive", true)}
            class="flex-1 flex items-center justify-center py-2.5 bg-surface text-text-primary rounded-full font-medium text-sm shadow-sm hover:bg-divider transition-colors cursor-pointer active:scale-[0.97]"
          >
            <span class="inline-flex items-center gap-1.5 -translate-x-1">
              <ArrowDownLeft size={16} class="shrink-0" aria-hidden />
              Receive
            </span>
          </button>
        </div>

        {/* Tokens */}
        <div class="bg-surface rounded-2xl w-full shrink-0">
          <div class="flex items-center justify-between px-4 pt-3 pb-2">
            <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Tokens
            </h3>
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
