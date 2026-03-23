import { formatUsd } from "@shared/format";
import { useNavigate } from "@solidjs/router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  LoaderCircle,
  Plus,
  Settings,
  SlidersHorizontal,
} from "lucide-solid";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Address } from "viem";
import { AccountSwitcher } from "../components/AccountSwitcher";
import { ActivitySection } from "../components/ActivitySection";
import { NetworkBadge } from "../components/NetworkBadge";
import { TokenRowSkeleton } from "../components/Skeleton";
import { TokenRow } from "../components/TokenRow";
import {
  fetchActivity,
  hideToken,
  parseUsdValue,
  refreshAll,
  showNetworkSelector,
  walletState,
} from "../store";
import { AddToken } from "./AddToken";
import { NetworkSelector } from "./NetworkSelector";

const STALE_MS = 10_000;

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
  const navigate = useNavigate();
  const [showAddToken, setShowAddToken] = createSignal(false);
  const [managingTokens, setManagingTokens] = createSignal(false);
  let lastFetch = 0;

  const usdTotal = createMemo(() =>
    balanceUsdTotal(walletState.ethBalance(), walletState.nativeUsdPrice()),
  );

  const sortedTokens = createMemo(() => {
    const all = walletState.tokens();
    const native = all.filter((t) => !t.address);
    const erc20 = all
      .filter((t) => t.address)
      .sort((a, b) => parseUsdValue(b.usdValue) - parseUsdValue(a.usdValue));
    return [...native, ...erc20];
  });

  const _hasHideableTokens = createMemo(() =>
    sortedTokens().some((t) => t.address && canHideToken(t)),
  );

  function canHideToken(token: { address?: string; balance: string; usdValue?: string }): boolean {
    if (!token.address) return false;
    const bal = parseFloat(token.balance);
    if (Number.isNaN(bal) || bal === 0) return true;
    return parseUsdValue(token.usdValue) < 1;
  }

  onMount(() => {
    const now = Date.now();
    if (now - lastFetch < STALE_MS) return;
    lastFetch = now;
    refreshAll();
    fetchActivity().catch(() => {});
  });

  return (
    <div class="flex flex-col h-[600px]">
      {/* Header */}
      <header class="shrink-0 flex items-center justify-between px-4 h-12">
        <NetworkBadge />
        <button
          type="button"
          onClick={() => navigate("/settings", { replace: true })}
          aria-label="Settings"
          class="p-1.5 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Outside scroll so account menu stacks above list; avoids overflow clip */}
      <div class="shrink-0 px-4 pt-3 pb-3">
        <AccountSwitcher usdTotal={usdTotal()} loading={walletState.balanceLoading()} />
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        {/* Quick Actions */}
        <div class="flex gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/send", { replace: true })}
            class="flex-1 flex items-center justify-center py-2.5 bg-accent text-accent-foreground rounded-full font-medium text-sm hover:bg-accent-hover transition-colors cursor-pointer active:scale-[0.97]"
          >
            <span class="inline-flex items-center gap-1.5 -translate-x-1">
              <ArrowUpRight size={16} class="shrink-0" aria-hidden />
              Send
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/receive", { replace: true })}
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
            <h3 class="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Tokens
              <Show when={walletState.balanceLoading()}>
                <LoaderCircle size={11} class="animate-spin text-text-tertiary" />
              </Show>
            </h3>
            <button
              type="button"
              onClick={() => setManagingTokens((v) => !v)}
              class={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
                managingTokens()
                  ? "text-accent font-medium"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <SlidersHorizontal size={11} />
              {managingTokens() ? "Done" : "Manage"}
            </button>
          </div>
          <div class="divide-y divide-divider">
            <Show
              when={walletState.tokens().length > 0}
              fallback={
                <>
                  <TokenRowSkeleton />
                  <TokenRowSkeleton />
                  <TokenRowSkeleton />
                </>
              }
            >
              <For each={sortedTokens()}>
                {(token) => (
                  <TokenRow
                    token={token}
                    chainId={walletState.activeNetwork().id}
                    managing={managingTokens()}
                    canHide={canHideToken(token)}
                    onHide={() => hideToken(token.address as Address)}
                  />
                )}
              </For>
            </Show>
            <Show when={managingTokens()}>
              <button
                type="button"
                onClick={() => setShowAddToken(true)}
                class="flex items-center gap-2 w-full px-4 py-3 text-xs text-accent hover:bg-base/50 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Add token
              </button>
            </Show>
          </div>
        </div>

        {/* Activity */}
        <ActivitySection account={walletState.activeAccount()} />
      </div>

      <Show when={showNetworkSelector()}>
        <NetworkSelector />
      </Show>
      <AddToken open={showAddToken()} onClose={() => setShowAddToken(false)} />
    </div>
  );
}
