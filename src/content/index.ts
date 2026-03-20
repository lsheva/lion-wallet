import browser from "webextension-polyfill";
import { CHANNEL } from "../shared/messages";

const script = document.createElement("script");
script.src = browser.runtime.getURL("inpage.js");
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.type !== CHANNEL || msg.direction !== "request") return;

  const origin = window.location.origin;

  browser.runtime
    .sendMessage({
      type: "RPC_REQUEST",
      id: msg.id,
      method: msg.method,
      params: msg.params,
      origin,
    })
    .then((response: unknown) => {
      const res = response as
        | { ok: true; data?: { result?: unknown; error?: unknown } }
        | { ok: false; error: string };

      if (!res.ok) {
        // postMessage uses "*" because content → inpage is same-window; no cross-origin
        // frame can access this window object. A tighter targetOrigin isn't possible here
        // since the page origin varies per site.
        window.postMessage(
          {
            type: CHANNEL,
            direction: "response",
            id: msg.id,
            error: { code: -32603, message: res.error },
          },
          "*",
        );
        return;
      }

      const rpcResult = res.data as
        | { result: unknown }
        | { error: { code: number; message: string; data?: unknown } }
        | undefined;

      if (rpcResult && "error" in rpcResult) {
        window.postMessage(
          {
            type: CHANNEL,
            direction: "response",
            id: msg.id,
            error: rpcResult.error,
          },
          "*",
        );
      } else {
        window.postMessage(
          {
            type: CHANNEL,
            direction: "response",
            id: msg.id,
            result: rpcResult?.result,
          },
          "*",
        );
      }
    })
    .catch((err: Error) => {
      window.postMessage(
        {
          type: CHANNEL,
          direction: "response",
          id: msg.id,
          error: { code: -32603, message: err.message },
        },
        "*",
      );
    });
});

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as { type: string; direction: string; event: string; data: unknown };
  if (msg.type === CHANNEL && msg.direction === "event") {
    window.postMessage(msg, "*");
  }
});
