import { CHANNEL } from "../shared/protocol";

const script = document.createElement("script");
script.src = browser.runtime.getURL("inpage.js");
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

type BrowserRuntimeResponse = { ok: true; data?: RPCResult } | { ok: false; error: string };

type RPCResult = { result: unknown } | { error: { code: number; message: string; data?: unknown } };

browser.runtime.onMessage.addListener((message: unknown) => {
  if (isValidEvent(message)) {
    window.postMessage(message, "*");
  }
});

window.addEventListener("message", async (event: MessageEvent) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!isValidRequest(msg)) return;

  const origin = window.location.origin;
  const faviconUrl = getPageFaviconUrl();

  try {
    const res: BrowserRuntimeResponse = await browser.runtime.sendMessage({
      type: "RPC_REQUEST",
      id: msg.id,
      method: msg.method,
      params: msg.params,
      origin,
      ...(faviconUrl ? { faviconUrl } : {}),
    });

    if (!res.ok) {
      // postMessage uses "*" because content → inpage is same-window; no cross-origin
      // frame can access this window object. A tighter targetOrigin isn't possible here
      // since the page origin varies per site.
      void sendResponse(msg.id, undefined, { code: -32603, message: res.error });
      return;
    }

    const rpcResult = res.data;

    if (rpcResult && "error" in rpcResult) {
      void sendResponse(msg.id, undefined, rpcResult.error);
      return;
    }

    void sendResponse(msg.id, rpcResult?.result);
  } catch (err) {
    void sendResponse(msg.id, undefined, { code: -32603, message: (err as Error).message });
  }
});

function sendResponse(
  id: string,
  result: unknown,
  error?: { code: number; message: string; data?: unknown },
): void {
  window.postMessage(
    {
      type: CHANNEL,
      direction: "response",
      id,
      ...(result ? { result } : {}),
      ...(error ? { error } : {}),
    },
    "*",
  );
}

function getPageFaviconUrl(): string | undefined {
  const links = document.querySelectorAll(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
  );
  for (const el of links) {
    const href = el.getAttribute("href");
    if (!href) continue;
    try {
      return new URL(href, window.location.href).href;
    } catch {
      /* try next */
    }
  }
  try {
    return new URL("/favicon.ico", window.location.origin).href;
  } catch {
    return undefined;
  }
}

function isValidRequest(msg: unknown): msg is {
  type: string;
  direction: string;
  id: string;
  method: string;
  params: unknown;
} {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === CHANNEL &&
    m.direction === "request" &&
    typeof m.id === "string" &&
    typeof m.method === "string"
  );
}

function isValidEvent(msg: unknown): msg is {
  type: string;
  direction: string;
  event: string;
  data: unknown;
} {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return m.type === CHANNEL && m.direction === "event" && typeof m.event === "string";
}
