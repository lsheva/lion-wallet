import lionIconSvg from "../icons/icon.svg";
import { CHANNEL, MESSAGE_TIMEOUT_MS } from "../shared/protocol";

let requestId = 0;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

class EventEmitter {
  private _listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  on(event: string, fn: (...args: unknown[]) => void): this {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(fn);
    return this;
  }

  removeListener(event: string, fn: (...args: unknown[]) => void): this {
    this._listeners.get(event)?.delete(fn);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return false;
    set.forEach((fn) => {
      try {
        fn(...args);
      } catch (e) {
        console.error("[LionWallet] event listener error:", e);
      }
    });
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.size ?? 0;
  }
}

class EIP1193Provider extends EventEmitter {
  readonly isMetaMask = true;
  readonly isLionWallet = true;

  private _chainId: string | null = null;
  private _accounts: string[] = [];
  private _connected = false;

  constructor() {
    super();
    this._init();
  }

  private _init(): void {
    window.addEventListener("message", (event: MessageEvent) => {
      if (event.source !== window) return;
      const msg = event.data;
      if (
        !msg ||
        typeof msg !== "object" ||
        msg.type !== CHANNEL ||
        typeof msg.direction !== "string"
      )
        return;

      if (msg.direction === "response") {
        if (typeof msg.id !== "string") return;
        const entry = pending.get(msg.id);
        if (!entry) return;
        pending.delete(msg.id);

        if (msg.error && typeof msg.error === "object") {
          const err = Object.assign(new Error(String(msg.error.message ?? "Unknown error")), {
            code: typeof msg.error.code === "number" ? msg.error.code : -32603,
            data: msg.error.data,
          });
          entry.reject(err);
        } else {
          entry.resolve(msg.result);
        }
      }

      if (msg.direction === "event") {
        if (typeof msg.event === "string") {
          this._handleEvent(msg.event, msg.data);
        }
      }
    });
  }

  private _handleEvent(event: string, data: unknown): void {
    switch (event) {
      case "chainChanged": {
        if (typeof data !== "string") return;
        if (this._chainId !== data) {
          this._chainId = data;
          this.emit("chainChanged", data);
        }
        break;
      }
      case "accountsChanged": {
        if (!Array.isArray(data)) return;
        const accounts = data as string[];
        this._accounts = accounts;
        this.emit("accountsChanged", accounts);
        if (accounts.length === 0) {
          this._connected = false;
          this.emit("disconnect", { code: 4900, message: "Disconnected" });
        }
        break;
      }
      case "connect": {
        if (
          !data ||
          typeof data !== "object" ||
          typeof (data as Record<string, unknown>).chainId !== "string"
        )
          return;
        const { chainId } = data as { chainId: string };
        this._chainId = chainId;
        this._connected = true;
        this.emit("connect", { chainId });
        break;
      }
      case "disconnect": {
        this._connected = false;
        this._accounts = [];
        this.emit("disconnect", data);
        break;
      }
    }
  }

  async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
    const { method, params } = args;
    const id = `${CHANNEL}_${++requestId}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });

      window.postMessage(
        {
          type: CHANNEL,
          direction: "request",
          id,
          method,
          params,
        },
        "*",
      );

      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(Object.assign(new Error("Request timed out"), { code: -32603 }));
        }
      }, MESSAGE_TIMEOUT_MS);
    }).then((result) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") {
        this._accounts = (result as string[]) ?? [];
        if (this._accounts.length > 0 && !this._connected) {
          this._connected = true;
        }
      }
      if (method === "eth_chainId") {
        this._chainId = result as string;
      }
      return result;
    });
  }

  isConnected(): boolean {
    return this._connected;
  }

  /** @deprecated legacy — use request() instead */
  async enable(): Promise<string[]> {
    return this.request({ method: "eth_requestAccounts" }) as Promise<string[]>;
  }

  /** @deprecated legacy send method */
  send(method: string, params?: unknown[]): Promise<unknown> {
    return this.request({ method, params });
  }

  /** @deprecated legacy sendAsync method */
  sendAsync(
    payload: { method: string; params?: unknown[]; id?: number },
    callback: (err: unknown, result?: unknown) => void,
  ): void {
    this.request({ method: payload.method, params: payload.params })
      .then((result) => callback(null, { id: payload.id, jsonrpc: "2.0", result }))
      .catch((err) => callback(err));
  }
}

function announceProvider(provider: EIP1193Provider): void {
  const info = {
    uuid: "f7e2c1b4-8a9d-4e3f-9c2b-1d0e8f7a6b5c",
    name: "Lion Wallet",
    icon: `data:image/svg+xml,${encodeURIComponent(lionIconSvg.trim())}`,
    rdns: "dev.wallet.lion",
  };

  const detail = Object.freeze({ info, provider });
  window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
  window.addEventListener("eip6963:requestProvider", () => {
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
  });
}

(function inject() {
  if (typeof window === "undefined") return;

  const provider = new EIP1193Provider();

  Object.defineProperty(window, "ethereum", {
    value: provider,
    writable: false,
    configurable: true,
  });

  announceProvider(provider);
})();
