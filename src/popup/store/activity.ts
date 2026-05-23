/**
 * Activity feed signals + lazy `fetchActivity`. Push-side updates from the
 * background arrive via the `ACTIVITY_UPDATED` runtime message handled in
 * [`../App.tsx`](../App.tsx).
 */
import { toErrorMessage } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { ActivityItem } from "@shared/types";
import { batch, createSignal, untrack } from "solid-js";
import { type Address, zeroAddress } from "viem";
import { showError } from "../toast";
import { activeAccount } from "./accounts";
import { activeNetworkId } from "./network";

export type { ActivityItem };

export const [activity, setActivity] = createSignal<ActivityItem[]>([]);
export const [activityLoading, setActivityLoading] = createSignal(false);
export const [activitySource, setActivitySource] = createSignal<
  "etherscan" | "rpc" | "cache" | null
>(null);
export const [activityHasMore, setActivityHasMore] = createSignal(false);

export async function fetchActivity(options?: { loadMore?: boolean }): Promise<void> {
  const account = untrack(activeAccount);
  if (!account.address || account.address === zeroAddress) return;
  setActivityLoading(true);
  try {
    const res = await sendMessage({
      type: "GET_ACTIVITY",
      address: account.address as Address,
      chainId: untrack(activeNetworkId),
      ...(options?.loadMore ? { loadMore: true } : {}),
    });
    if (res.ok && res.data) {
      batch(() => {
        setActivity(res.data.items);
        setActivitySource(res.data.source);
        setActivityHasMore(res.data.hasMore);
      });
    }
  } catch (e) {
    showError("Could not load activity", toErrorMessage(e));
  } finally {
    setActivityLoading(false);
  }
}
