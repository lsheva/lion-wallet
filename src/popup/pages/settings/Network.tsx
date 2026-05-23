/**
 * Active-chain row + per-chain "re-scan activity" trigger.
 */
import { ChevronRight, RefreshCw } from "lucide-solid";
import { Show } from "solid-js";
import { Card } from "../../components/Card";
import { ChainIcon } from "../../components/ChainIcon";
import { setShowNetworkSelector, walletState } from "../../store";

export function Network() {
  return (
    <Card header="Network" padding={false}>
      <div class="divide-y divide-divider">
        <button
          type="button"
          onClick={() => setShowNetworkSelector(true)}
          class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2">
            <ChainIcon chainId={walletState.activeNetwork().id} size={16} />
            <span class="text-sm text-text-primary">{walletState.activeNetwork().name}</span>
          </div>
          <ChevronRight size={16} class="text-text-tertiary" />
        </button>
        <Show when={walletState.accounts().some((a) => a.path !== "imported")}>
          <button
            type="button"
            onClick={() => void walletState.refreshChainDiscovery()}
            disabled={walletState.chainDiscoveryScanning()}
            class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div class="flex items-center gap-2">
              <RefreshCw
                size={16}
                class={
                  walletState.chainDiscoveryScanning()
                    ? "text-accent animate-spin"
                    : "text-text-tertiary"
                }
              />
              <span class="text-sm text-text-primary">Re-scan chain activity</span>
            </div>
            <span class="text-[11px] text-text-tertiary">balances &amp; tx count</span>
          </button>
        </Show>
      </div>
    </Card>
  );
}
