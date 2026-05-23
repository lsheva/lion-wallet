/**
 * "About" / update-check section. Polls the background `CHECK_UPDATE` once
 * on mount; force-refresh button re-checks ignoring the throttle.
 */
import { getExtensionVersion } from "@shared/extension-version";
import { sendMessage } from "@shared/messages";
import { ArrowUpCircle, ExternalLink, RefreshCw } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import { Card } from "../../components/Card";

const currentVersion = getExtensionVersion();

export function UpdateSection() {
  const [latest, setLatest] = createSignal("");
  const [downloadUrl, setDownloadUrl] = createSignal("");
  const [updateAvailable, setUpdateAvailable] = createSignal(false);
  const [checking, setChecking] = createSignal(false);

  const doCheck = async (force = false) => {
    setChecking(true);
    try {
      const res = await sendMessage({ type: "CHECK_UPDATE", force });
      if (res.ok && res.data) {
        setLatest(res.data.latest);
        setDownloadUrl(res.data.downloadUrl);
        setUpdateAvailable(res.data.updateAvailable);
      }
    } finally {
      setChecking(false);
    }
  };

  onMount(() => doCheck());

  return (
    <Card header="About" padding={false}>
      <div class="px-4 py-3 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-primary">
            Lion Wallet <span class="font-mono text-text-tertiary">v{currentVersion}</span>
          </span>
          <button
            type="button"
            onClick={() => doCheck(true)}
            disabled={checking()}
            class="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} class={checking() ? "animate-spin" : ""} />
          </button>
        </div>

        <Show when={updateAvailable()}>
          <a
            href={downloadUrl()}
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            <ArrowUpCircle size={16} class="text-accent shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-accent">Update available</p>
              <p class="text-xs text-text-tertiary">v{latest()} — tap to download</p>
            </div>
            <ExternalLink size={12} class="text-accent shrink-0" />
          </a>
        </Show>
      </div>
    </Card>
  );
}
