/**
 * Safari natively provides the `browser` global (WebExtensions API).
 * Chrome builds shim it via `globalThis.browser = chrome` in entry files.
 */
import type Browser from "webextension-polyfill";

declare global {
  const browser: typeof Browser;
  const chrome: typeof Browser;
}
