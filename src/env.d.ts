/// <reference types="vite/client" />

export interface ImportMetaEnv {
  /** `pnpm dev:mock` sets `VITE_MOCK=true` — popup in a normal tab, seeded UI, no background. */
  readonly VITE_MOCK?: string;
  /**
   * Unpacked extension ID from `chrome://extensions` (Developer mode). Required for `pnpm dev`
   * when the popup is opened as a normal tab at `localhost` so `runtime.sendMessage` can target the background.
   */
  readonly VITE_EXTENSION_ID?: string;
}
