import { sendMessage } from "@shared/messages";
import { Link2, Trash2 } from "lucide-solid";
import { createSignal, For, onMount, Show } from "solid-js";
import { Header } from "../components/Header";
import { showError } from "../toast";

export function ConnectedSites() {
  const [origins, setOrigins] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [revoking, setRevoking] = createSignal<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await sendMessage({ type: "GET_CONNECTED_SITES" });
    if (res.ok) {
      setOrigins(res.data.origins);
    } else {
      showError(res.error);
    }
    setLoading(false);
  };

  onMount(load);

  const revoke = async (origin: string) => {
    setRevoking(origin);
    const res = await sendMessage({ type: "REVOKE_CONNECTED_ORIGIN", origin });
    setRevoking(null);
    if (!res.ok) {
      showError(res.error);
      return;
    }
    await load();
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Connected sites" onBack="/settings" />

      <div class="flex-1 overflow-y-auto px-4 pt-2 pb-4">
        <Show when={loading()}>
          <p class="text-sm text-text-secondary text-center py-8">Loading…</p>
        </Show>

        <Show when={!loading() && origins().length === 0}>
          <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Link2 size={40} class="text-text-tertiary mb-3" />
            <p class="text-sm text-text-secondary">
              No sites connected yet. Sites you approve will appear here. You can disconnect any
              site to require approval again next time.
            </p>
          </div>
        </Show>

        <Show when={!loading() && origins().length > 0}>
          <ul class="rounded-[var(--radius-card)] border border-divider overflow-hidden divide-y divide-divider">
            <For each={origins()}>
              {(origin) => (
                <li class="flex items-center gap-3 px-4 py-3 bg-surface">
                  <span class="flex-1 min-w-0 text-xs font-mono text-text-primary break-all text-left">
                    {origin}
                  </span>
                  <button
                    type="button"
                    onClick={() => revoke(origin)}
                    disabled={revoking() !== null}
                    class="shrink-0 p-2 rounded-[var(--radius-chip)] text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer disabled:opacity-50"
                    title="Disconnect site"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </div>
  );
}
