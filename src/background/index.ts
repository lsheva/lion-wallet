import type { Runtime } from "webextension-polyfill/namespaces/runtime";
import type { MessageRequest, MessageResponse } from "../shared/messages";
import { bootstrapBackground } from "./bootstrap";
import { bgLog } from "./log";
import { routeBackgroundMessage } from "./message-router";

bootstrapBackground();

browser.runtime.onMessage.addListener((message: unknown, _sender: Runtime.MessageSender) => {
  const msg = message as MessageRequest;
  return routeBackgroundMessage(msg).catch((err: Error) => {
    bgLog("[background] routeBackgroundMessage failed:", err);
    return { ok: false, error: err.message };
  }) as Promise<MessageResponse>;
});
