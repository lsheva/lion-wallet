import { getPendingCount } from "./approval";
import { broadcastEvent, broadcastPendingCount, updateBadge } from "./broadcast";
import { ensureConnectedOriginsLoaded } from "./connected-origins";
import { bgLog } from "./log";
import { loadRpcProviderKey } from "./networks";
import { setApprovalCreatedCallback } from "./rpc-handler";
import { getStorageMode } from "./vault";

/** Shared startup for extension service worker and Vite dev tab service worker. */
export function bootstrapBackground(): void {
  ensureConnectedOriginsLoaded().catch((e) => {
    bgLog("[background] ensureConnectedOriginsLoaded failed:", e);
  });

  updateBadge();
  browser.runtime.onInstalled.addListener(() => updateBadge());
  browser.runtime.onStartup?.addListener(() => updateBadge());

  setApprovalCreatedCallback(() => {
    updateBadge();
    broadcastPendingCount();
    void (async () => {
      const mode = await getStorageMode();
      if (mode === "keychain") {
        broadcastEvent("approvalPending", { count: getPendingCount() });
      }
      try {
        (browser.action as { openPopup?: () => void }).openPopup?.();
      } catch {
        /* popup couldn't be opened programmatically */
      }
    })();
  });

  loadRpcProviderKey().catch((e) => {
    bgLog("[background] loadRpcProviderKey failed:", e);
  });
  bgLog("[background] service worker loaded");
}
