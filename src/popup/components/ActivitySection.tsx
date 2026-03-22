import { useNavigate } from "@solidjs/router";
import { Loader2 } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { fetchActivity, walletState } from "../store";
import { ActivityRow } from "./ActivityRow";
import { ActivityRowSkeleton } from "./Skeleton";

const PAGE_SIZE = 5;

export function ActivitySection(props: { account: { address: string } }) {
  const [displayCount, setDisplayCount] = createSignal(PAGE_SIZE);
  const navigate = useNavigate();

  const items = () => walletState.activity();
  const loading = () => walletState.activityLoading();
  const hasMore = () => walletState.activityHasMore();
  const visible = () => items().slice(0, displayCount());
  const canShowMore = () => displayCount() < items().length || hasMore();

  const network = () => walletState.activeNetwork();
  const explorerUrl = () => network().blockExplorerUrl;
  const nativeSymbol = () => network().nativeCurrency.symbol;

  const handleLoadMore = async () => {
    if (displayCount() < items().length) {
      setDisplayCount((c) => c + PAGE_SIZE);
    } else if (hasMore()) {
      await fetchActivity({ loadMore: true });
      setDisplayCount((c) => c + PAGE_SIZE);
    }
  };

  return (
    <div class="bg-surface rounded-2xl w-full">
      <div class="flex items-center gap-2 px-4 pt-3 pb-2">
        <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider">Activity</h3>
        <Show when={loading()}>
          <Loader2 size={12} class="animate-spin text-text-tertiary" />
        </Show>
      </div>
      <Show
        when={visible().length > 0}
        fallback={
          <Show
            when={loading()}
            fallback={
              <p class="px-4 py-6 text-sm text-text-tertiary text-center">No recent activity</p>
            }
          >
            <div class="divide-y divide-divider">
              <ActivityRowSkeleton />
              <ActivityRowSkeleton />
              <ActivityRowSkeleton />
            </div>
          </Show>
        }
      >
        <div class="divide-y divide-divider">
          <For each={visible()}>
            {(item) => (
              <ActivityRow
                item={item}
                userAddress={props.account.address}
                explorerUrl={explorerUrl()}
                nativeSymbol={nativeSymbol()}
              />
            )}
          </For>
        </div>
        <Show when={canShowMore()}>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading()}
            class="w-full py-2.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading() ? "Loading…" : "Load More"}
          </button>
        </Show>
        <Show when={walletState.activitySource() === "rpc"}>
          <p class="px-4 py-2 text-[10px] text-text-tertiary text-center">
            <button
              type="button"
              onClick={() => navigate("/settings", { replace: true })}
              class="text-accent hover:text-accent-hover cursor-pointer"
            >
              Add Etherscan key
            </button>{" "}
            for full history.
          </p>
        </Show>
      </Show>
    </div>
  );
}
