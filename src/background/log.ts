export function bgLog(...args: unknown[]): void {
  // biome-ignore lint/suspicious/noConsole: this IS the logging utility
  console.log(...args);
  const serialized = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)));
  browser.runtime.sendMessage({ type: "BG_LOG", args: serialized }).catch(() => {
    console.error("failed to send BG_LOG message", args);
  });
}
