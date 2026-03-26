export function bgLog(...args: unknown[]): void {
  const parts = args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)));
  const msg = parts.join(" ");
  // biome-ignore lint/suspicious/noConsole: this IS the logging utility
  console.log(msg);
  browser.runtime.sendMessage({ type: "BG_LOG", msg }).catch(() => {});
}
