import type { Tabs } from "webextension-polyfill/namespaces/tabs";
import { CHANNEL } from "../shared/messages";
import { getPendingCount } from "./approval";
import { bgLog } from "./log";

export function broadcastEvent(event: string, data: unknown): void {
  const payload = {
    type: CHANNEL,
    direction: "event" as const,
    event,
    data,
  };
  browser.tabs.query({}).then((tabs: Tabs.Tab[]) => {
    for (const tab of tabs) {
      if (tab.id != null) {
        browser.tabs.sendMessage(tab.id, payload).catch((e: unknown) => {
          bgLog("[broadcast] sendMessage to tab", tab.id, "failed:", e);
        });
      }
    }
  });
}

export function broadcastPendingCount(): void {
  const count = getPendingCount();
  browser.runtime.sendMessage({ type: "PENDING_COUNT", count }).catch(() => {
    /* popup not open — expected */
  });
}

/** RGBA 0–255 — WebKit/Safari often ignores hex strings for badge color. */
const BADGE_THEME_RGBA: [number, number, number, number] = [217, 119, 6, 255];

export function updateBadge(): void {
  const count = getPendingCount();
  browser.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  void browser.action.setBadgeBackgroundColor({ color: BADGE_THEME_RGBA });
}
