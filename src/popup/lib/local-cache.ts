/**
 * Tiny typed wrapper around `localStorage` for popup persistence.
 *
 * Replaces the try/JSON.parse/catch boilerplate that was duplicated across
 * `store.ts`, `AccountSwitcher.tsx`, the theme picker in `Settings.tsx`, etc.
 *
 * ```ts
 * const networkIds = defineLocalStore<number[]>("userNetworkIds", []);
 * networkIds.get();                  // -> number[] (defaults if missing/corrupt)
 * networkIds.set([1, 8453]);         // serializes via JSON.stringify
 * networkIds.patch((prev) => [...prev, 137]);
 * networkIds.remove();
 * ```
 *
 * All errors (quota exceeded, private mode, malformed JSON) are swallowed and
 * `get()` falls back to the default value — caches must never crash the popup.
 */
export interface LocalStore<T> {
  get(): T;
  set(value: T): void;
  patch(updater: (prev: T) => T): void;
  remove(): void;
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function defineLocalStore<T>(key: string, defaultValue: T): LocalStore<T> {
  return {
    get(): T {
      const raw = readRaw(key);
      if (raw == null) return defaultValue;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return defaultValue;
      }
    },
    set(value: T): void {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* quota / private mode — non-critical */
      }
    },
    patch(updater): void {
      this.set(updater(this.get()));
    },
    remove(): void {
      try {
        localStorage.removeItem(key);
      } catch {
        /* non-critical */
      }
    },
  };
}
