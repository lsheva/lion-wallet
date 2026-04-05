/// <reference lib="webworker" />

/**
 * Minimal `browser` / `chrome` shim for running `src/background` inside a normal
 * `navigator.serviceWorker` (pnpm dev in a browser tab). Not a full WebExtension surface.
 */
declare const self: ServiceWorkerGlobalScope;
const storageData = new Map<string, unknown>();

function storageGet(
  keys?: string | string[] | Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  if (keys == null || keys === "") {
    return Promise.resolve(Object.fromEntries(storageData));
  }
  if (typeof keys === "string") {
    return Promise.resolve({ [keys]: storageData.get(keys) });
  }
  if (Array.isArray(keys)) {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (storageData.has(k)) out[k] = storageData.get(k);
    }
    return Promise.resolve(out);
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(keys)) {
    if (keys[k]) out[k] = storageData.get(k);
  }
  return Promise.resolve(out);
}

function storageSet(items: Record<string, unknown>): Promise<void> {
  for (const [k, v] of Object.entries(items)) {
    storageData.set(k, v);
  }
  return Promise.resolve();
}

function storageRemove(keys: string | string[]): Promise<void> {
  const list = typeof keys === "string" ? [keys] : keys;
  for (const k of list) {
    storageData.delete(k);
  }
  return Promise.resolve();
}

export function installDevServiceWorkerBrowserPolyfill(): void {
  const scope = self.registration?.scope
    ? self.registration.scope
    : self.location?.origin
      ? `${self.location.origin}/`
      : "/";

  const api = {
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
        remove: storageRemove,
      },
    },
    runtime: {
      id: "dev-tab-service-worker",
      getURL: (path: string) => new URL(path, scope).href,
      getManifest: () => ({ version: "0.0.0-dev" }),
      onInstalled: { addListener(_fn: () => void) {}, removeListener(_fn: () => void) {} },
      onStartup: { addListener(_fn: () => void) {}, removeListener(_fn: () => void) {} },
      onMessage: {
        addListener: (_fn: unknown) => {},
        removeListener: (_fn: unknown) => {},
      },
      sendMessage: async (msg: unknown) => {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const c of clients) {
          c.postMessage(msg);
        }
      },
      sendNativeMessage: async () =>
        ({ ok: false, error: "Native messaging unavailable in dev tab service worker" }) as const,
    },
    tabs: {
      query: async () => [],
      sendMessage: async () => {},
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
    },
  };

  const g = globalThis as typeof globalThis & { browser?: typeof api; chrome?: typeof api };
  g.browser = api;
  g.chrome = api;
}

/** Runs when this module is loaded (dev service worker entry must import this file first). */
installDevServiceWorkerBrowserPolyfill();
