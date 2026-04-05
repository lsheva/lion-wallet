/**
 * Vite dev runs the popup in a normal browser tab without a full WebExtensions host.
 * `runtime.getManifest` may be missing; avoid throwing at module load.
 */
export function getExtensionVersion(): string {
  try {
    const gm = (
      globalThis as unknown as {
        browser?: { runtime?: { getManifest?: () => { version: string } } };
      }
    ).browser?.runtime?.getManifest;
    if (typeof gm === "function") {
      return gm().version;
    }
  } catch {
    /* non-extension context */
  }
  return "dev";
}
