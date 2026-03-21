import { Loader2 } from "lucide-preact";
import { useState } from "preact/hooks";
import { route } from "preact-router";
import { fetchActivity, walletState } from "../store";
import { ActivityRow } from "./ActivityRow";

const PAGE_SIZE = 5;

export function ActivitySection({ account }: { account: { address: string } }) {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const items = walletState.activity.value;
  const loading = walletState.activityLoading.value;
  const hasMore = walletState.activityHasMore.value;
  const visible = items.slice(0, displayCount);
  const canShowMore = displayCount < items.length || hasMore;

  const network = walletState.activeNetwork.value;
  const explorerUrl = network.chain.blockExplorers?.default?.url;
  const nativeSymbol = network.chain.nativeCurrency.symbol;

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
              <ActivityRow
                key={item.hash}
                item={item}
                userAddress={account.address}
                explorerUrl={explorerUrl}
                nativeSymbol={nativeSymbol}
              />
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
