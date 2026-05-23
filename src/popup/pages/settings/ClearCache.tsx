/**
 * Wipes activity caches in both the background (`CLEAR_ACTIVITY_CACHE`) and
 * the popup (`clearPopupCache`). Used when API responses look stale or the
 * user wants a fresh state.
 */
import { sendMessage } from "@shared/messages";
import { Check, Trash2 } from "lucide-solid";
import { createSignal } from "solid-js";
import { Card } from "../../components/Card";
import { clearPopupCache } from "../../store";

export function ClearCacheRow() {
  const [cleared, setCleared] = createSignal(false);
  const [clearError, setClearError] = createSignal(false);

  const handleClear = async () => {
    if (cleared()) return;
    setClearError(false);
    const res = await sendMessage({ type: "CLEAR_ACTIVITY_CACHE" });
    if (!res.ok) {
      setClearError(true);
      setTimeout(() => setClearError(false), 3000);
      return;
    }
    clearPopupCache();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <Card header="Data" padding={false}>
      <button
        type="button"
        onClick={handleClear}
        class={`flex items-center gap-2 w-full px-4 py-3 transition-colors cursor-pointer text-left ${
          clearError() ? "text-danger" : cleared() ? "text-success" : "text-danger hover:bg-base/50"
        }`}
      >
        {cleared() ? <Check size={16} /> : <Trash2 size={16} />}
        <span class="text-sm font-medium">
          {clearError()
            ? "Failed to clear cache"
            : cleared()
              ? "Activity Cache Cleared"
              : "Clear Activity Cache"}
        </span>
      </button>
    </Card>
  );
}
