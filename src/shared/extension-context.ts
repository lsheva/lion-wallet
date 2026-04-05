/** True when running inside an extension page / popup (`runtime.id` is set). */
export function hasBrowserExtensionContext(): boolean {
  try {
    const g = globalThis as typeof globalThis & { browser?: { runtime?: { id?: string } } };
    const id = g.browser?.runtime?.id;
    return typeof id === "string" && id.length > 0;
  } catch {
    return false;
  }
}
