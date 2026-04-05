/// <reference lib="webworker" />

/** Must be first: installs global `browser` / `chrome` before background modules load. */
import "../dev/dev-browser-polyfill";
import { bootstrapBackground } from "../background/bootstrap";
import { routeBackgroundMessage } from "../background/message-router";
import type { MessageRequest } from "../shared/messages";

bootstrapBackground();

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const d = event.data as { channel?: string; request?: MessageRequest } | undefined;
  const port = event.ports[0];
  if (d?.channel !== "lion-dev-request" || !port) return;
  const req = d.request;
  if (!req) return;
  void routeBackgroundMessage(req).then(
    (response) => port.postMessage(response),
    (err: Error) => port.postMessage({ ok: false, error: err.message }),
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});
