
import { bgLog } from "./log";

/**
 * Generic in-memory cache backed by browser.storage.local.
 *
 * - `load()` lazily reads from storage on first call, then returns the in-memory copy.
 * - `persist()` writes the in-memory copy back to storage.
 * - Direct access via `data` getter after `load()`.
 */
export class StorageCache<T extends Record<string, unknown>> {
  private _mem: T | null = null;
  private readonly _key: string;
  private readonly _label: string;

  constructor(storageKey: string, label?: string) {
    this._key = storageKey;
    this._label = label ?? storageKey;
  }

  async load(): Promise<T> {
    if (this._mem) return this._mem;
    try {
      const r = await browser.storage.local.get(this._key);
      this._mem = ((r[this._key] as T) ?? {}) as T;
    } catch (e) {
      bgLog(`[${this._label}] load failed:`, e);
      this._mem = {} as T;
    }
    return this._mem;
  }

  async persist(): Promise<void> {
    if (!this._mem) return;
    try {
      await browser.storage.local.set({ [this._key]: this._mem });
    } catch (e) {
      bgLog(`[${this._label}] persist failed:`, e);
    }
  }

  /** Reset in-memory state (forces re-read from storage on next load). */
  clear(): void {
    this._mem = null;
  }

  async clearStorage(): Promise<void> {
    this._mem = {} as T;
    try {
      await browser.storage.local.remove(this._key);
    } catch (e) {
      bgLog(`[${this._label}] clearStorage failed:`, e);
    }
  }
}
