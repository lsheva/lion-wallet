/**
 * Safari natively provides the `browser` global (WebExtensions API).
 *
 * We use @types/webextension-polyfill for type definitions only — no runtime
 * polyfill is bundled. If targeting Chrome or other browsers that lack a native
 * `browser` global, add `webextension-polyfill` as a runtime dependency and
 * replace this file with `import browser from "webextension-polyfill"` in each
 * file that uses `browser.*`.
 */
import type Browser from "webextension-polyfill";

declare global {
  const browser: typeof Browser;
}
