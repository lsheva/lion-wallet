/**
 * Background logger. Mirrors every message to the popup DevTools via a
 * runtime `BG_LOG` message so background errors are visible without opening
 * `chrome://extensions` → service worker → inspect.
 *
 * Errors are stringified by stack so traces survive the trip through
 * `runtime.sendMessage`; primitives keep their natural toString.
 */
function formatArg(a: unknown): string {
  if (a instanceof Error) return a.stack ?? `${a.name}: ${a.message}`;
  if (a === null || a === undefined) return String(a);
  if (typeof a === "object") {
    try {
      return JSON.stringify(a, null, 2);
    } catch {
      return String(a);
    }
  }
  return String(a);
}

export function bgLog(...args: unknown[]): void {
  const msg = args.map(formatArg).join(" ");
  // biome-ignore lint/suspicious/noConsole: this IS the logging utility
  console.log(msg);
  browser.runtime.sendMessage({ type: "BG_LOG", msg }).catch(() => {});
}
