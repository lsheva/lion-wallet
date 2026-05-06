/// <reference lib="webworker" />

/**
 * Minimal `browser` / `chrome` shim for running `src/background` inside a normal
 * `navigator.serviceWorker` (pnpm dev in a browser tab). Not a full WebExtension surface.
 *
 * `browser.storage.local` is backed by IndexedDB on the dev origin (service workers have no
 * `localStorage`; this gives the same “stick across reloads” behavior for pnpm dev).
 */
declare const self: ServiceWorkerGlobalScope;

const IDB_NAME = "lion-wallet-dev-storage";
const IDB_VERSION = 1;
const IDB_STORE = "kv";

let dbOpen: Promise<IDBDatabase> | null = null;

function openIdb(): Promise<IDBDatabase> {
  if (!dbOpen) {
    dbOpen = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onerror = () => {
        dbOpen = null;
        reject(req.error ?? new Error("IndexedDB open failed"));
      };
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
    });
  }
  return dbOpen;
}

async function idbReadAll(): Promise<Map<string, unknown>> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const map = new Map<string, unknown>();
    const tx = db.transaction(IDB_STORE, "readonly");
    const q = tx.objectStore(IDB_STORE).openCursor();
    q.onsuccess = () => {
      const c = q.result;
      if (c) {
        map.set(String(c.key), c.value);
        c.continue();
      } else {
        resolve(map);
      }
    };
    q.onerror = () => reject(q.error ?? new Error("IndexedDB cursor error"));
  });
}

async function idbGetOne(key: string): Promise<unknown> {
  if (key === "") return undefined;
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB get error"));
  });
}

async function idbPut(entries: Record<string, unknown>): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write error"));
    const st = tx.objectStore(IDB_STORE);
    for (const [k, v] of Object.entries(entries)) {
      st.put(v, k);
    }
  });
}

async function idbDelete(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete error"));
    const st = tx.objectStore(IDB_STORE);
    for (const k of keys) {
      st.delete(k);
    }
  });
}

function storageGet(
  keys?: string | string[] | Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  if (keys == null || keys === "") {
    return idbReadAll().then((m) => Object.fromEntries(m));
  }
  if (typeof keys === "string") {
    return idbGetOne(keys).then((v) => (v === undefined ? {} : { [keys]: v }));
  }
  if (Array.isArray(keys)) {
    return (async () => {
      const out: Record<string, unknown> = {};
      for (const k of keys) {
        const v = await idbGetOne(k);
        if (v !== undefined) out[k] = v;
      }
      return out;
    })();
  }
  return (async () => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(keys)) {
      if (!keys[k]) continue;
      const v = await idbGetOne(k);
      if (v !== undefined) out[k] = v;
    }
    return out;
  })();
}

function storageSet(items: Record<string, unknown>): Promise<void> {
  return idbPut(items);
}

function storageRemove(keys: string | string[]): Promise<void> {
  const list = typeof keys === "string" ? [keys] : keys;
  return idbDelete(list);
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
