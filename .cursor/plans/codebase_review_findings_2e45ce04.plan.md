---
name: Codebase Review Findings
overview: Comprehensive code review of Lion Wallet covering security, error handling, types, repetition, complexity, rerenders, style guide compliance, and best practices -- organized by phase from quickest to largest.
todos:
  - id: critical-vault-keys
    content: "[P1] Fix imported private keys not persisted in vault mode — extend VaultData, update encryptVault calls (#1, #5)"
    status: completed
  - id: json-parse-safety
    content: "[P1] Wrap JSON.parse in signing.ts and etherscan.ts with try/catch (#2)"
    status: completed
  - id: rpc-param-validation
    content: "[P1] Validate params shape in wallet_switchEthereumChain / wallet_addEthereumChain (#3)"
    status: completed
  - id: postmessage-origin
    content: "[P1] Document or tighten window.postMessage target origin in content script — currently uses '*' (#4)"
    status: completed
  - id: error-handling-catch
    content: "[P1] Replace empty catch {} blocks and .catch(() => {}) with logging across background scripts (#6, #7)"
    status: completed
  - id: channel-dedup
    content: "[P1] Import CHANNEL constant from shared/messages in content and inpage scripts (#13)"
    status: completed
  - id: button-type
    content: "[P1] Add type='button' to ~35 buttons across Modal, Header, Send, NetworkSelector, Settings, Approve, Home, etc. (#16)"
    status: completed
  - id: hardcoded-color
    content: "[P1] Replace hardcoded #FFF0F0 in ConfirmSeed with CSS variable (#17)"
    status: completed
  - id: remove-console-log
    content: "[P1] Remove console.log from Approve.tsx TxContent production path (#18)"
    status: completed
  - id: debounce-inputs
    content: "[P1] Add debounce to NetworkSelector chain detection and AddToken address input (#22)"
    status: completed
  - id: dirname-esm
    content: "[P1] Replace __dirname in vite.config.ts with import.meta.url + fileURLToPath for ESM safety (#32)"
    status: completed
  - id: timeout-align
    content: "[P1] Align sendMessage timeout (30s) with provider RPC timeout (60s), or document why they differ (#34)"
    status: completed
  - id: eventemitter-catch
    content: "[P1] Replace empty catch in provider EventEmitter.emit with console.error (#35)"
    status: completed
  - id: web3icons-deps
    content: "[P1] Move @web3icons/core from devDependencies to dependencies since it ships runtime code (#36)"
    status: completed
  - id: add-biome
    content: "[P2] Add Biome linter/formatter: install @biomejs/biome, create biome.json, add lint/format scripts (#33)"
    status: pending
  - id: build-typecheck
    content: "[P2] Add tsgo --noEmit to build:ext script; include scripts/ in TypeScript config (#29, #31)"
    status: pending
  - id: replace-esbuild-rolldown
    content: "[P2] Replace esbuild with Rolldown in scripts/build.ts: build() API + minify, remove esbuild dep (#38)"
    status: pending
  - id: icons-build-dep
    content: "[P2] Ensure icons exist before extension build: run icons script in build:ext or fail if missing (#30)"
    status: pending
  - id: extract-truncate
    content: "[P3] Move truncateAddress to shared/format.ts, remove 4 duplicates (#10)"
    status: pending
  - id: ui-error-handling
    content: "[P3] Add missing error handling in ImportWallet paste, Receive QR, Send fetchBalance, TxResult RPC, Settings cache clear (#8)"
    status: pending
  - id: fix-rerenders
    content: "[P3] Pass network as prop to ActivityRow/TokenRow; add staleness guard to Home fetches (#23, #24, #25)"
    status: pending
  - id: extract-helpers
    content: "[P3] Extract persistWalletData, toErrorMessage, RevealSecretPage, ResultPage, useAutoCloseQueue (#9, #11, #12, #15)"
    status: pending
  - id: storage-cache-util
    content: "[P3] Create generic StorageCache<T> utility for the repeated load/persist pattern (#14)"
    status: pending
  - id: content-validation
    content: "[P3] Add runtime validation for incoming messages in content script and inpage provider (#28)"
    status: pending
  - id: type-responses
    content: "[P4] Type sendMessage responses properly instead of using as casts (#26, #27)"
    status: pending
  - id: split-approve
    content: "[P4] Split Approve.tsx (~840 lines) into separate component files (#20)"
    status: pending
  - id: split-index-ts
    content: "[P4] Split handleMessage in background/index.ts into per-domain handler modules (#19)"
    status: pending
  - id: refactor-activity
    content: "[P4] Refactor activity.ts (558 lines): extract sub-functions from fetchActivity and enrichWithDecoding (#21)"
    status: pending
  - id: bundle-size
    content: "[P4] Audit and reduce bundle size: lazy-load routes, tree-shake viem/lucide, bundle font, evaluate chain-icons (#44)"
    status: pending
  - id: skeleton-loading
    content: "[P5] Add skeleton/shimmer placeholders for async data; reserve layout space to prevent content shift (#45)"
    status: pending
  - id: implement-add-token
    content: "[P5] Replace mock fetchTokenInfo in AddToken.tsx with real ERC-20 metadata lookup (#37)"
    status: pending
  - id: token-images
    content: "[P5] Lazy-loaded token images via Cache API with LRU eviction, TokenImage component, batch prefetch (#48)"
    status: pending
  - id: dev-ux-all-states
    content: "[P5] Expand DevToolbar to all 19 routes; mock data setup for approval, session, activity; storageMode toggle (#40)"
    status: pending
  - id: dark-theme
    content: "[P5] Add dark theme: dark color tokens, prefers-color-scheme, manual toggle in Settings, persist preference (#47)"
    status: pending
  - id: keyboard-a11y
    content: "[P5] Keyboard accessibility: focus-visible styles, tab order, Enter/Space on interactives, aria labels, modal focus trap (#46)"
    status: pending
  - id: platform-abstraction
    content: "[P6] Create src/platform/ with SecureStorage, PopupController, PlatformCapabilities interfaces; per-browser manifests (#39)"
    status: pending
  - id: tx-retry-stuck
    content: "[P6] Pending TX management: PendingTxTracker module, auto-detect stuck txs, offer retry with higher gas (#41)"
    status: pending
  - id: tx-replace-flow
    content: "[P6] TX replacement flow: detect pending conflict, ask retry/replace, handle race if old tx mines first (#42)"
    status: pending
  - id: tx-cancel
    content: "[P6] TX cancellation: 0-value self-transfer with same nonce + higher gas, success/failure confirmation (#43)"
    status: pending
  - id: multi-keyring
    content: "[P6] Multi-keyring support: import multiple mnemonics, hierarchical account grouping by keyring, persist all keyrings in vault/keychain (#49)"
    status: pending
isProject: false
---

# Lion Wallet — Codebase Review

---

## Phase 1 — Quick Fixes

Small, mechanical changes with no cross-file dependencies. Each is a few lines to a few dozen lines.

### 1. Imported private keys are never persisted in vault mode

In `src/background/index.ts`, `encryptVault` is always called with `{ mnemonic, accounts, activeAccountIndex }` but never includes `importedKeys`. Meanwhile, `retrieveImportedKey` for vault mode tries to read `data.importedKeys`, which is never set. **Imported accounts in vault mode cannot sign** — their keys are silently lost on next session.

- **Fix**: Extend `VaultData` in [types.ts](src/shared/types.ts) to include `importedKeys?: Record<string, string>`, and pass them into `encryptVault` calls in `IMPORT_PRIVATE_KEY` and `CREATE_WALLET` handlers.

### 5. `VaultData` type mismatch / unsafe cast

`index.ts` line ~129 uses `(data as unknown as Record<string, unknown>).importedKeys` — this bypasses TypeScript entirely and is the symptom of the missing `importedKeys` field on `VaultData`. Fixed together with #1.

### 2. `JSON.parse` without try/catch in signing and Etherscan paths

- [signing.ts](src/background/signing.ts) line ~149: `JSON.parse(params[1])` for typed data — malformed input crashes the handler
- [etherscan.ts](src/background/etherscan.ts) line ~187: `JSON.parse(json.result)` — Etherscan returning malformed JSON crashes decode
- **Fix**: Wrap both in try/catch; return a typed error.

### 3. No input validation on `wallet_switchEthereumChain` / `wallet_addEthereumChain`

[rpc-handler.ts](src/background/rpc-handler.ts) casts `params as [{ chainId: Hex }]` without checking if `params` is non-empty or has the right shape. A dApp sending `[]` or malformed params crashes the handler.

### 4. Content script posts responses with `"*"` target origin

[content/index.ts](src/content/index.ts) uses `window.postMessage(msg, "*")`. While same-window messages make this mostly benign, it allows any frame to intercept responses. Standard practice, but worth documenting or tightening.

### 6. Swallowed `.catch(() => {})` — 8+ instances

Background scripts silently swallow errors in broadcasting, activity enrichment, and startup:

- `index.ts`: `browser.tabs.sendMessage().catch(() => {})` (broadcast), `loadRpcProviderKey().catch(() => {})`
- `activity.ts`: `enrichEtherscanAsync().catch(() => {})`, `browser.runtime.sendMessage().catch(() => {})`
- `log.ts`: `browser.runtime.sendMessage().catch(() => {})`

**Fix**: At minimum, log to console in catch blocks. For startup (`loadRpcProviderKey`), surface the error since it affects all RPC calls.

### 7. 10+ empty `catch {}` blocks in vault, keychain, etherscan, activity

Storage persistence errors, keychain operations, and cache clears all use empty `catch {}`. If storage is full or keychain is misconfigured, failures are invisible.

**Fix**: Add `console.warn` or `bgLog` in catch blocks; consider surfacing keychain errors to the user.

### 13. `CHANNEL` constant defined in 3 places

`"LION_WALLET"` is defined in `messages.ts`, `content/index.ts`, and `inpage/provider.ts`.
**Fix**: Content and inpage should import from `shared/messages`. (Inpage may need build adjustment since it's IIFE-bundled.)

### 16. ~35 buttons missing `type="button"`

The style guide requires all buttons to have `type="button"`. Major offenders:

- [Modal.tsx](src/popup/components/Modal.tsx): close button
- [Header.tsx](src/popup/components/Header.tsx): back button
- [Send.tsx](src/popup/pages/Send.tsx): token picker, paste, MAX buttons
- [NetworkSelector.tsx](src/popup/pages/NetworkSelector.tsx): back, add network, list items
- [Settings.tsx](src/popup/pages/Settings.tsx): all SettingsRow, account items, edit, add, clear cache, API key rows
- [Approve.tsx](src/popup/pages/Approve.tsx): gas speed, details toggle, raw data toggle
- [Home.tsx](src/popup/pages/Home.tsx): send, receive, add token, settings
- And many more across ConfirmSeed, AccountSwitcher, Tabs, NetworkBadge, etc.

### 17. Hardcoded color `#FFF0F0` in ConfirmSeed.tsx

Should use a CSS variable like `--color-danger-bg`.

### 18. `console.log` left in production path

[Approve.tsx](src/popup/pages/Approve.tsx) `TxContent` logs decoded/transfers/debug data. Should be removed or guarded behind dev mode.

### 22. No debounce on NetworkSelector chain detection and AddToken address input

`handleDetectChain` fires on every keystroke; `handleAddressInput` fetches on every valid input.
**Fix**: Add debounce (e.g. 300ms).

### 32. `__dirname` used in `vite.config.ts` under ESM

With `"type": "module"`, `__dirname` is undefined in strict ESM. Vite may handle this, but it's fragile.
**Fix**: Use `fileURLToPath(import.meta.url)` + `dirname`.

### 34. Timeout mismatch: `sendMessage` (30s) vs provider RPC (60s)

If the provider's 60s timeout fires, the 30s `sendMessage` timeout has already rejected. Align or document the intentional difference.

### 35. `EventEmitter.emit` in provider swallows all errors

`try { fn(...args); } catch {}` — listener errors are silently lost. Should at least `console.error`.

### 36. `@web3icons/core` in devDependencies but used at runtime

If it contributes code that ships in the bundle, it should be a regular dependency (cosmetic, since bundlers resolve from either).

---

## Phase 2 — Tooling & Build

Set up quality infrastructure so all subsequent work benefits from linting, type-checking, and a streamlined build.

### 33. No linter or formatter configured

No ESLint, Prettier, or Biome config. Code style is enforced only by the style guide document.

**Fix**: Add **Biome** as linter and formatter:

- Install: `pnpm add -D @biomejs/biome`
- Create `biome.json` with:
  - Formatter: indent with tabs or spaces (match current style), line width 100
  - Linter rules enabled: `recommended` + `noExplicitAny`, `useButtonType` (catches missing `type="button"`), `noConsoleLog` (warn)
  - Organize imports enabled
- Add scripts to `package.json`:
  - `"lint": "biome check src/"` — lint + format check
  - `"lint:fix": "biome check --write src/"` — auto-fix
  - `"format": "biome format --write src/"` — format only
- The `useButtonType` rule will automatically catch all ~35 missing `type="button"` violations (#16)
- The `noConsoleLog` rule will flag the leftover `console.log` in Approve.tsx (#18)

### 29. `build:ext` (and `build:safari`) skip type-checking

Only `build` runs `tsgo --noEmit`; the full extension build (`build:ext`) does not.
**Fix**: Prepend `tsgo --noEmit &&` to `build:ext`.

### 31. `scripts/` excluded from TypeScript checking

`tsconfig.json` includes only `["src"]`. Build and icon scripts are never type-checked.
**Fix**: Add a `tsconfig.scripts.json` or include `"scripts"`. Fixed together with #29.

### 38. Replace esbuild with Rolldown + add minification

[scripts/build.ts](scripts/build.ts) uses esbuild directly for background, content-script, and inpage bundles. Since Vite 8 is already in the project and ships Rolldown internally, the separate esbuild dependency is redundant. Additionally, none of the esbuild outputs are minified.

**Fix**: Replace esbuild with Rolldown's `build()` API in `scripts/build.ts`:

```typescript
import { build } from "rolldown";

await Promise.all([
  build({
    input: "src/background/index.ts",
    output: { file: "dist/background.js", format: "esm", minify: true },
    platform: "browser",
  }),
  build({
    input: "src/content/index.ts",
    output: { file: "dist/content-script.js", format: "iife", minify: true },
    platform: "browser",
  }),
  build({
    input: "src/inpage/provider.ts",
    output: { file: "dist/inpage.js", format: "iife", minify: true },
    platform: "browser",
    moduleTypes: { ".svg": "text" },
  }),
]);
```

Then:

- `pnpm remove esbuild`
- `pnpm add -D rolldown`
- Remove `esbuild` from `pnpm.onlyBuiltDependencies`

Benefits: one fewer native dependency to build, consistent toolchain (Vite + Rolldown), and minified output.

### 30. Icons not guaranteed to exist before extension build

`build.ts` copies `src/icons/generated` only if it exists. `build:ext` never runs `icons`.
**Fix**: Either run `icons` as part of `build:ext` or fail the build if icons are missing.

---

## Phase 3 — Small Refactors

Extract shared helpers, reduce duplication, fix isolated UI issues. Each touches a handful of files.

### 10. `truncateAddress` reimplemented 4+ times

Exists independently in Approve.tsx, AddressDisplay.tsx, ActivityRow.tsx, Settings.tsx.
**Fix**: Move to [shared/format.ts](src/shared/format.ts).

### 8. UI error handling gaps

- [ImportWallet.tsx](src/popup/pages/ImportWallet.tsx): `handlePaste` has no try/catch (clipboard can throw)
- [Receive.tsx](src/popup/pages/Receive.tsx): `QRCode.toCanvas` has no error handling
- [Send.tsx](src/popup/pages/Send.tsx): `fetchBalance` catch is empty
- [AddToken.tsx](src/popup/pages/AddToken.tsx): `fetchTokenInfo` is still mocked
- [TxResult.tsx](src/popup/pages/TxResult.tsx): RPC failure returns `null` with no user feedback
- [Settings.tsx](src/popup/pages/Settings.tsx): `CLEAR_ACTIVITY_CACHE` failure not handled

### 23. `ActivityRow` and `TokenRow` subscribe to `activeNetwork` signal

Every row in the list independently reads `activeNetwork.value`, causing all rows to rerender on network change.
**Fix**: Pass `network` (or just `chainId` / `explorerUrl`) as a prop from the parent.

### 24. `Home.tsx` calls `refreshAll()` and `fetchActivity()` on every mount

No guard or staleness check; opening Home always triggers full refetches.
**Fix**: Add a staleness check (e.g. skip if last fetch was <10s ago). Fixed together with #23.

### 25. Large components read multiple signals at top level

`Send.tsx` reads `tokens` and `network`; `Settings.tsx` reads 4 signals. Any signal change rerenders the entire page.
**Fix**: Split into smaller sub-components that each subscribe only to what they need, or use `computed` signals. Fixed together with #23.

### 9. Keychain vs vault persistence (3 blocks in `index.ts`)

`CREATE_WALLET`, `IMPORT_WALLET`, `IMPORT_PRIVATE_KEY` all repeat the same pattern:

1. Check `isKeychainAvailable()`
2. If keychain: store + `setStorageMode("keychain")` + `saveAccountsMeta` + `broadcastEvent`
3. Else: `setStorageMode("vault")` + `encryptVault` + `saveAccountsMeta` + `broadcastEvent`

**Fix**: Extract a `persistWalletData(mode, mnemonic, accounts, password?)` helper.

### 11. ExportPrivateKey / ShowRecoveryPhrase are near-identical pages

Same flow: password/Touch ID auth, reveal toggle, loading, error, copy. ~80% shared code.
**Fix**: Extract a `RevealSecretPage` component parameterized by secret type. Fixed together with #9.

### 12. TxResult / SignResult share layout and auto-close logic

Both implement the same 5s countdown, queue check, and result card.
**Fix**: Extract a `ResultPage` layout and `useAutoCloseQueue` hook. Fixed together with #9.

### 15. `e instanceof Error ? e.message : String(e)` repeated many times

**Fix**: Add a `toErrorMessage(e: unknown): string` helper in shared. Fixed together with #9.

### 14. Cache load/persist pattern repeated across 4 modules

`etherscan.ts`, `activity.ts`, `prices.ts`, `tx-simulator.ts` all implement the same in-memory-cache + `browser.storage.local` load/persist pattern.
**Fix**: Create a generic `StorageCache<T>` utility.

### 28. Content script and provider use loose casts on `event.data`

No runtime validation; should validate shape before accessing fields.

---

## Phase 4 — Typing & Structure

Medium refactors that improve type safety, split oversized files, and optimize bundle delivery.

### 26. Numerous `as` casts on `sendMessage` responses

`store.ts`, `Welcome.tsx`, `SetPassword.tsx`, `App.tsx` etc. all cast `res.data as { ... }`. The `MessageResponse` type should carry typed `data` per message type (discriminated union on response type).

### 27. `approval.ts` uses `resolve: (result: unknown) => void`

The result type should be narrowed per approval type (tx hash string vs signature string). Fixed together with #26.

### 20. `Approve.tsx` is ~840 lines

Contains `TxContent`, `SignContent`, `DecodedCallCard`, `TransfersCard`, `DevTx`, `DevSign`.
**Fix**: Split into separate component files under `components/approve/`.

### 19. `handleMessage` in `index.ts` is ~250 lines of switch cases

**Fix**: Split into per-domain handler modules (wallet handlers, RPC handlers, settings handlers) and have the main switch dispatch to them.

### 21. `activity.ts` is 558 lines with deeply nested logic

`fetchActivity` (~~150 lines) and `enrichWithDecoding` (~~120 lines) have complex branching.
**Fix**: Extract sub-functions and consider a pipeline pattern.

### 44. Audit and reduce popup bundle size

The popup bundles all pages eagerly — every route (19 total) and all dependencies load on popup open, even though the user only sees one page at a time. Heavy dependencies in the popup bundle include `viem` (used in Approve, NetworkSelector, ActivityRow, store), `lucide-preact` (icons imported per-component), and `chain-icons.ts` (SVG strings for 86 chains).

**Fix**:

- **Analyze**: Run `vite build --report` or `rollup-plugin-visualizer` to identify the largest chunks
- **Lazy-load routes**: Use dynamic `import()` for heavy pages that aren't always needed — Approve, NetworkSelector, Send, Settings, ExportPrivateKey, ShowRecoveryPhrase. Preact supports `lazy()` + `Suspense`
- **Tree-shake viem**: Only `formatGwei`, `formatEther`, `formatUnits`, `defineChain` are used in popup code — ensure the bundler isn't pulling in the full viem library. Consider re-exporting just the needed functions from a thin barrel file
- **Lucide icons**: Each page imports individual icons; verify tree-shaking is working (lucide-preact supports it, but barrel re-exports can defeat it)
- **Chain icons**: `chain-icons.ts` contains inline SVG strings for 86 chains. Consider lazy-loading the map or splitting mainnet/testnet icons
- **Font**: `@font-face` src points to a Google Fonts CSS URL instead of a WOFF2 file — this is broken. Download JetBrains Mono WOFF2 files (regular + semibold weights), place them in `src/popup/fonts/`, and update `globals.css` to reference the local files. This bundles the font into the extension — no external network request, works offline, and loads instantly

---

## Phase 5 — UI Polish

Medium-large features that improve the user experience. Each is self-contained but touches multiple files.

### 45. Skeleton loading and no content shift

Currently, pages that load async data (Home: balance + tokens + activity, Approve: gas + decoded call + simulation, Send: token balance) show either nothing or a `Spinner` while loading. This causes layout shift when data arrives and makes the UI feel unresponsive.

**Fix**:

- **Skeleton component**: Create a reusable `Skeleton` component (`src/popup/components/Skeleton.tsx`) — a rounded rectangle with a shimmer animation (CSS `@keyframes shimmer` using `background: linear-gradient` sweep). Variants: `text` (single line, variable width), `circle` (avatar), `card` (full-width block)
- **Home page**: Replace the empty state with skeleton rows for token list (3–4 rows matching `TokenRow` height), skeleton for balance header (matching the `$X,XXX.XX` layout), and skeleton for activity section
- **Approve page**: Skeleton for gas presets (3 columns matching the gas speed grid), skeleton for decoded call card, skeleton for transfers card
- **Send page**: Skeleton for balance display while `fetchBalance` is in flight
- **Reserve layout space**: All skeleton elements must match the exact height/width of their real counterparts to prevent content shift. Use `min-height` on containers where the content size varies
- **Transition**: Fade from skeleton to real content using `animate-fade-in` (already defined in globals.css)

### 37. AddToken still uses mock data

`fetchTokenInfo` has a hardcoded 900ms delay and returns mock data. Needs real implementation.

### 48. Lazy-loaded, cached token logos

ERC-20 tokens currently display a colored circle with the first letter of the symbol ([TokenRow.tsx](src/popup/components/TokenRow.tsx) line 36–42). No actual token logos are shown anywhere. `TokenInfo` has no image field.

**Fix**:

- **Add `logoUrl?: string` to `TokenInfo`** in [types.ts](src/shared/types.ts) — optional so tokens without images still work
- **Token image source**: Trust Wallet assets CDN — deterministic URLs from chain + checksummed contract address (`https://raw.githubusercontent.com/niconiahi/trustwallet-assets/master/blockchains/{chain}/assets/{checksumAddress}/logo.png`), no API key. Fall back to CoinGecko token image API on 404
- **Cache via the Cache API** (`src/background/token-images.ts`):
  - Use `caches.open("token-logos")` in the background service worker — stores native binary `Response` objects with zero base64 encoding overhead. Supported in Safari, Chrome, and Firefox MV3 service workers. Persistent across sessions
  - `getTokenImage(chainId, address)`: check `cache.match(url)` first; on hit return immediately. On miss, `fetch()` from CDN, `cache.put(url, response.clone())`, return the response
  - **No TTL** — token logos essentially never change. Only evict via LRU when size cap is hit
  - **LRU eviction with size cap**: maintain a lightweight access-order index in `browser.storage.local` (array of URL strings, ~1KB for hundreds of tokens). When cache exceeds a configurable limit (e.g. 5MB / ~500 tokens at ~10KB avg PNG), evict least-recently-used entries via `cache.delete(oldestKey)`. Move accessed keys to the end of the array on each hit
  - **Batch prefetch**: when the token list loads on Home, fire `prefetchTokenImages(tokens)` that fetches all missing logos in parallel (concurrency limit of 4) — images are ready before the user scrolls
  - On fetch failure, store a sentinel response (empty, with a custom header `x-miss: 1`) so repeated failures don't re-fetch. Retry misses after 24h
- **Popup reads via message** — popup sends `GET_TOKEN_IMAGE { chainId, address }` to background; background returns a blob URL (via `URL.createObjectURL`) from the cached response. Alternatively, the popup can construct the same CDN URL and the service worker can intercept via `fetch` event to serve from cache (more elegant, fewer messages)
- `**TokenImage` component (`src/popup/components/TokenImage.tsx`):
  - Props: `address?: string`, `chainId: number`, `symbol: string`, `color: string`, `size: number`
  - On mount, requests the image URL from background (or constructs CDN URL directly if using fetch-event interception)
  - Three render states:
    1. **Cached hit**: `<img>` with the URL, `rounded-full`, fade-in transition, `loading="lazy"`
    2. **Loading**: Colored-circle fallback (letter initial) — fixed dimensions, no layout shift
    3. **Failed/missing**: Permanent colored-circle fallback (same as current)
  - `onError` handler to degrade gracefully
  - Fixed `width`/`height` attributes to prevent content shift
- **Update `TokenRow`**: Replace the inline colored circle `<div>` with `<TokenImage>` for ERC-20 tokens. Native tokens continue using `<ChainIcon>`
- **Update `Send.tsx` token picker**: Show token images in the dropdown
- **Update `Approve.tsx` transfers card**: Show token images next to transfer amounts

### 40. Dev mode only covers 8 of 19 routes — many states unreachable

The [DevToolbar](src/popup/mock/DevToolbar.tsx) currently navigates to: Welcome, Home, Approve, TX OK/Fail, Sig OK/Fail, Settings. The remaining 11 pages are unreachable without manually typing URLs or clicking through flows that depend on real extension APIs.

**Missing from DevToolbar:**

| Route                   | Problem in dev mode                                               |
| ----------------------- | ----------------------------------------------------------------- |
| `/set-password`         | Not in toolbar                                                    |
| `/seed-phrase`          | Not in toolbar; needs mock mnemonic from previous step            |
| `/confirm-seed`         | Not in toolbar; needs seed phrase array in memory                 |
| `/import`               | Not in toolbar                                                    |
| `/api-key-setup`        | Not in toolbar                                                    |
| `/send`                 | Not in toolbar; needs mock tokens + balance                       |
| `/receive`              | Not in toolbar; needs active account                              |
| `/export-key`           | Not in toolbar; auth flow has no mock fallback                    |
| `/show-phrase`          | Not in toolbar; same auth issue                                   |
| `/approve` (sign)       | Toolbar lands on tx approval; no way to see sign approval variant |
| `/approve` (typed data) | No mock for `eth_signTypedData_v4`                                |

**Data dependencies not mocked:**

- `TxResult` / `SignResult` read from `sessionStorage` (`txHash`, `txChainId`, `signature`, `signMethod`) — dev mode sets none of these, so result pages show blank/error
- `Approve` reads from `pendingApprovalData` signal — toolbar navigates to `/approve` but never populates this signal with mock data, so the page shows nothing useful
- `ExportPrivateKey` / `ShowRecoveryPhrase` send `EXPORT_PRIVATE_KEY` / `EXPORT_MNEMONIC` messages to the background — dev mode has no mock handler, so they always fail
- Activity list in Home has no mock items

**Fix**:

1. **Expand DevToolbar** to include all 19 routes, grouped by flow:

- Onboarding: Welcome, SetPassword, SeedPhrase, ConfirmSeed, Import, ApiKeySetup
- Main: Home, Send, Receive, Settings, ExportKey, ShowPhrase
- Approval: Approve (tx), Approve (sign), Approve (typed data), TX OK, TX Fail, Sig OK, Sig Fail

1. **Add mock data setup per navigation** — when the toolbar navigates to a page, it should also set the required signals/sessionStorage:

- Approve (tx): set `pendingApprovalData` to `MOCK_TX_REQUEST` with gas presets
- Approve (sign): set `pendingApprovalData` to `MOCK_SIGN_REQUEST`
- Approve (typed data): add `MOCK_TYPED_DATA_REQUEST` to [data.ts](src/popup/mock/data.ts) and set it
- TX OK: write mock `txHash` + `txChainId` to `sessionStorage`
- TX Fail: write mock error to `sessionStorage`
- Sig OK: write mock `signature` + `signMethod` to `sessionStorage`
- SeedPhrase: set mock mnemonic signal
- ConfirmSeed: set mock seed words array

1. **Add `storageMode` toggle** to DevToolbar — switch between `"keychain"` and `"vault"` to preview Touch ID vs password UI in Approve, ExportKey, ShowPhrase, Settings
2. **Mock `sendMessage` in dev mode** — intercept `EXPORT_PRIVATE_KEY`, `EXPORT_MNEMONIC`, `GET_PENDING_APPROVAL` etc. with mock responses so auth flows work without the extension runtime
3. **Add mock activity items** to [data.ts](src/popup/mock/data.ts) so the Home activity section renders with sample data (sent/received/contract interactions)

### 47. Dark theme

The UI uses CSS custom properties for all colors (defined in `globals.css` `@theme` block), which is the right foundation. But there are only light theme values — no dark variant, and a few hardcoded colors in components (e.g. `#FFF0F0` in ConfirmSeed).

**Fix**:

- **Define dark tokens** in `globals.css` using `@media (prefers-color-scheme: dark)`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-base: #1c1a17;
    --color-surface: #2a2520;
    --color-elevated: #332e28;
    --color-divider: #3d3630;
    --color-divider-strong: #4a423a;

    --color-text-primary: #f5f0eb;
    --color-text-secondary: #c4b8a8;
    --color-text-tertiary: #8a7d6e;

    --color-accent: #f59e0b;
    --color-accent-hover: #fbbf24;
    --color-accent-light: #451a03;
    --color-accent-foreground: #1c1a17;

    --color-success: #34c759;
    --color-danger: #ef4444;
    --color-danger-hover: #dc2626;
    --color-warning: #f97316;

    --color-warning-bg: #451a03;
    --color-warning-text: #fb923c;
    --color-danger-bg: #450a0a;
  }
}
```

- **Manual toggle**: Add a "Theme" option in Settings with three choices: System (default), Light, Dark. Store preference in `browser.storage.local`. Apply by setting a `data-theme="dark"` attribute on `<html>` and using `[data-theme="dark"]` selector alongside the media query
- **Eliminate hardcoded colors**: Replace `#FFF0F0` in ConfirmSeed (already #17) and any other inline hex values with CSS variables so they adapt to theme
- **Shadows**: Dark mode needs adjusted shadows — use lighter, more diffuse shadows or reduce opacity. Check Modal overlay, AccountSwitcher dropdown, NetworkSelector search
- **Chain icon contrast**: Some chain brand colors may not contrast well on dark backgrounds. Add a subtle background circle or adjust opacity for low-contrast icons

### 46. Keyboard accessibility

The only keyboard handling is in `AccountSwitcher` (proper `role`, `tabIndex`, `aria-` attributes) and `Settings` (Enter to confirm rename). The rest of the UI has no keyboard support — interactive `<div>` and `<span>` elements aren't focusable, modals don't trap focus, and there are no focus-visible styles.

**Fix**:

- **Focus-visible styles**: Add a global `focus-visible` ring style in `globals.css`:

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-chip);
}
```

- **Interactive elements**: All clickable `<div>`, `<span>`, and `<li>` elements need `role="button"`, `tabIndex={0}`, and `onKeyDown` handling (Enter + Space to activate). Major offenders: SettingsRow, TokenRow, ActivityRow, gas speed buttons in Approve, network items in NetworkSelector, word chips in ConfirmSeed
- **Modal focus trap**: [Modal.tsx](src/popup/components/Modal.tsx) already handles Escape to close but doesn't trap Tab. Add focus trapping: on open, focus the first focusable element; on Tab from the last element, cycle to the first; on Shift+Tab from the first, cycle to the last
- **Aria labels**: Add `aria-label` to icon-only buttons (close button in Modal, back arrow in Header, copy in CopyButton, show/hide password in Input)
- **Live regions**: Use `aria-live="polite"` for dynamic content updates — balance changes, error banners, success messages, copy confirmation
- **Skip links**: Not needed for a popup this size, but ensure logical tab order follows visual order (header -> content -> bottom actions)

---

## Phase 6 — Large Features

Full new systems requiring new modules, UI flows, and state management. Highest complexity.

### 39. Platform-specific code is hardwired to Safari + macOS

Currently, OS-specific and browser-specific logic is scattered across the codebase with no abstraction boundary. This blocks Chrome and Firefox support.

**OS-specific code (macOS only):**

- [keychain.ts](src/background/keychain.ts) — macOS Keychain via `browser.runtime.sendNativeMessage` to Swift `SafariWebExtensionHandler`
- Touch ID biometric auth (Keychain `.userPresence` access control)
- `storageMode: "keychain" | "vault"` branching in [index.ts](src/background/index.ts) — 3 repeated blocks for `CREATE_WALLET`, `IMPORT_WALLET`, `IMPORT_PRIVATE_KEY`

**Browser-specific code (Safari only):**

- [App.tsx `closePopup()](src/popup/App.tsx)`—`window.close()`with`route("/home", true)`fallback; comment explicitly warns against`browser.windows.remove` because Safari resolves it to the main browser window
- [content/index.ts](src/content/index.ts) — script injection and message bridging (mostly cross-browser via polyfill, but `CHANNEL` is duplicated)
- [manifest.json](src/manifest.json) — Safari MV3 format; Chrome/Firefox have different field requirements (`nativeMessaging` permission, `browser_specific_settings`, background `type`)

**UI code that branches on platform:**

- [Approve.tsx](src/popup/pages/Approve.tsx), [ExportPrivateKey.tsx](src/popup/pages/ExportPrivateKey.tsx), [ShowRecoveryPhrase.tsx](src/popup/pages/ShowRecoveryPhrase.tsx), [Welcome.tsx](src/popup/pages/Welcome.tsx), [Settings.tsx](src/popup/pages/Settings.tsx) — all check `storageMode` to show Touch ID vs password UI

**Fix**: Create `src/platform/` with clean interfaces and per-platform implementations:

```
src/platform/
  types.ts              — interface definitions
  detect.ts             — runtime platform detection
  safari/
    secure-storage.ts   — macOS Keychain implementation (current keychain.ts)
    popup.ts            — Safari popup close behavior
    manifest.json       — Safari-specific manifest
  chrome/
    secure-storage.ts   — Chrome placeholder (vault-only or chrome.storage.session)
    popup.ts            — Chrome popup close (window.close() works directly)
    manifest.json       — Chrome MV3 manifest
  firefox/
    secure-storage.ts   — Firefox placeholder (vault-only)
    popup.ts            — Firefox popup close
    manifest.json       — Firefox MV3 manifest (browser_specific_settings)
```

`**SecureStorage` interface (replaces direct keychain.ts imports):

```typescript
interface SecureStorage {
  isAvailable(): Promise<{ available: boolean; error?: string }>;
  store(key: string, value: string): Promise<{ ok: boolean; error?: string }>;
  retrieve(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}
```

`**PopupController` interface (replaces hardcoded `closePopup`):

```typescript
interface PopupController {
  close(): void;
}
```

`**PlatformCapabilities**` (runtime detection for UI branching):

```typescript
interface PlatformCapabilities {
  browser: "safari" | "chrome" | "firefox";
  hasBiometricAuth: boolean;
  hasNativeMessaging: boolean;
  secureStorage: SecureStorage;
  popup: PopupController;
}
```

The background's `index.ts` and the popup pages would import from `src/platform/` instead of directly from `keychain.ts`. The 3 repeated keychain-vs-vault blocks in `index.ts` (#9) would also be simplified by this — `secureStorage.store()` handles the right backend.

Build script would select the correct manifest and (optionally) tree-shake unused platform implementations based on a build target flag.

### 41. Stuck TX retry — auto-detect and offer higher gas

Currently, once a transaction is sent via `sendTransaction` in [signing.ts](src/background/signing.ts), the wallet forgets about it. The only tracking is `TxResult.tsx` polling `eth_getTransactionReceipt` for confirmation — but if the tx never mines, the user sees it stuck with no way to act.

**Fix**:

- **Background**: Add a `PendingTxTracker` module (`src/background/pending-txs.ts`) that stores submitted tx hashes with their nonce, account, chainId, gas params, and submission timestamp in `browser.storage.local`
- **Polling**: Periodically check `eth_getTransactionReceipt` for each pending tx. If unmined after a configurable timeout (e.g. 2 minutes), mark as "stuck"
- **Retry**: When stuck, compute new gas presets (re-call `estimateGasPresets`) and offer the user a "Speed Up" action that resubmits the same tx with the same nonce but higher `maxFeePerGas` / `maxPriorityFeePerGas`
- **UI**: Show stuck tx indicator in Home (e.g. a banner or badge), with a "Speed Up" button that opens an approval-like flow pre-filled with the bumped gas

### 42. TX replacement flow — retry vs replace when a prior tx is pending

When the user (or a dApp) submits a new transaction while a previous one from the same account on the same network is still pending:

**Fix**:

- **Detection**: Before creating a new approval, `rpc-handler.ts` checks `PendingTxTracker` for any pending txs from the same account + chainId
- **UI prompt**: If a conflict is found, show a modal: "You have a pending transaction (nonce N). Do you want to: (a) Replace it with this new transaction, or (b) Queue this after the pending one?"
- **Replace**: Reuse the same nonce as the stuck tx, with gas at least 10% higher (EIP-1559 replacement rules)
- **Race handling**: If polling detects the old tx mined while the user is deciding, dismiss the prompt, show a notification ("Previous transaction confirmed"), and let the new tx proceed with the next nonce
- **Nonce management**: Add `getNextNonce(account, chainId)` helper that accounts for both on-chain count and locally tracked pending txs

### 43. TX cancellation — send a 0-value self-transfer

Allow the user to cancel an unmined transaction.

**Fix**:

- **Mechanism**: Send a 0-value transaction to the user's own address with the same nonce as the stuck tx, using higher gas to outbid it
- **UI**: Add "Cancel" button alongside "Speed Up" in the stuck tx indicator. Opens a confirmation: "Cancel transaction? This will send a 0 ETH transaction with higher gas to replace it."
- **Result**: Show success/failure — if the cancellation tx mines, the original is dropped; if the original mines first, the cancellation fails (show "Original transaction already confirmed")
- **Activity**: Update activity list to reflect the cancellation (mark original as "Cancelled" if the 0-value replacement mined)

### 49. Multi-keyring support — import multiple mnemonics with hierarchical account access

**Terminology**: A **Keyring** is a group of HD-derived accounts that share a single mnemonic. Each keyring can derive multiple accounts (BIP-44 paths `m/44'/60'/0'/0/0`, `.../1`, `.../2`, etc.). The wallet can hold multiple keyrings, each with its own mnemonic and independent set of accounts. Imported standalone private keys (no mnemonic) belong to a special "Imported" pseudo-keyring.

There is no concept of an "active keyring" — all accounts from all keyrings are accessible at once. The keyring is purely an organizational parent: a structural grouping that tells the user which mnemonic an account belongs to and lets the wallet resolve the correct mnemonic when signing. The user picks any account from any keyring in a single flat list (grouped visually by keyring).

Currently the wallet stores a single `mnemonic` string and a flat `accounts` array. This limits the user to one seed phrase. Many users have multiple seed phrases from different wallets or for different purposes (e.g. hot wallet vs cold storage recovery, personal vs business).

**Fix**:

- **Data model** — replace the single mnemonic with a `keyrings` array. Each `Account` gains a `keyringId` back-reference so the wallet can resolve the correct mnemonic for signing:

```typescript
interface Keyring {
  id: string;               // stable UUID, generated on creation/import
  label: string;            // user-editable name (e.g. "Main", "Hardware backup", "Work")
  mnemonic: string;         // BIP-39 mnemonic phrase
  nextDerivationIndex: number; // next index to use when deriving a new account
  createdAt: number;        // timestamp for ordering
}

interface Account {
  address: string;
  name: string;
  keyringId: string;        // which keyring this account was derived from
  derivationIndex: number;  // BIP-44 index within the keyring
}

interface WalletState {
  keyrings: Keyring[];
  accounts: Account[];      // flat list of all accounts across all keyrings
  importedKeys: Record<string, string>; // standalone private key imports (no mnemonic)
  activeAccountAddress: string; // the currently selected account (from any keyring)
}
```

The `accounts` array stays flat — it contains every account from every keyring plus imported-key accounts (which have `keyringId: "imported"`). The keyring is looked up only when needed (signing, showing recovery phrase). This keeps account switching simple: just set `activeAccountAddress` to any account in the list.

- **Update `VaultData` and keychain storage** — `encryptVault` and `decryptVault` serialize the full `keyrings` array instead of a single mnemonic. Keychain storage (macOS) stores each keyring's mnemonic under a namespaced key (`lion-keyring-{id}`). Migration: on first unlock after upgrade, wrap the existing single mnemonic + accounts into a `Keyring` with `id: "default"` and `label: "Main Wallet"`
- **Background handlers**:
  - `CREATE_WALLET` — creates a new keyring with a fresh mnemonic, derives account 0, adds both to state
  - `IMPORT_WALLET` — creates a new keyring from the imported mnemonic, derives account 0, adds both to state. If the mnemonic already exists in another keyring, reject with an error
  - New: `RENAME_KEYRING { keyringId, label }` — updates the keyring's display name
  - New: `DELETE_KEYRING { keyringId }` — removes a keyring and all its derived accounts from state. Requires at least one keyring to remain. Prompts re-authentication (password or Touch ID). If the active account belonged to the deleted keyring, fall back to the first account of the next keyring
  - New: `DERIVE_ACCOUNT { keyringId }` — derives the next account from the keyring's mnemonic at `nextDerivationIndex`, appends to `accounts`, increments the index
  - `EXPORT_MNEMONIC { keyringId }` — exports the mnemonic of the specified keyring (defaults to the active account's `keyringId` if not provided)
  - `SWITCH_ACCOUNT` — works exactly as before; sets `activeAccountAddress`. No keyring switching needed — the account already knows its parent keyring
  - `RENAME_ACCOUNT`, `IMPORT_PRIVATE_KEY` — unchanged
- **Signing** — `getPrivateKey` looks up the account's `keyringId`, finds the matching keyring, and derives the private key at `derivationIndex`. For imported private keys (`keyringId: "imported"`), looks up `importedKeys[address]` as before
- **UI — hierarchical account list**:
  - **AccountSwitcher dropdown** (Header) — displays all accounts grouped under their parent keyring label. Each keyring section has a non-interactive header showing the keyring label (e.g. "Main Wallet", "Work") and a small count badge. Below each header, the keyring's accounts are listed. The "Imported" section appears at the bottom if any standalone keys exist. Selecting any account sets it as active — no intermediate step
  - **Settings page** — new "Keyrings" section listing all keyrings with their labels and account count. Tapping a keyring expands it to show: rename keyring, show recovery phrase, derive new account, delete keyring (if more than one exists). "Add Keyring" button at the bottom: "Create New" (generates fresh mnemonic) or "Import Existing" (navigates to the import flow)
  - **Header subtitle** — the active account shows its keyring label as a subtle subtitle under the account name, so the user always knows which keyring the current account belongs to
  - **Visual distinction** — each keyring gets an auto-assigned color dot (from a predefined palette of 6–8 colors) shown next to accounts in the switcher, so groups are visually distinct at a glance
- **Migration path**:
  1. On unlock, check if storage has old format (single `mnemonic` + flat `accounts` without `keyringId`)
  2. If so, create `keyrings: [{ id: "default", label: "Main Wallet", mnemonic, nextDerivationIndex: accounts.length, createdAt: Date.now() }]` and add `keyringId: "default"` + `derivationIndex: i` to each existing account
  3. Persist in new format. Old format is never written again
  4. `importedKeys` stays separate — accounts with imported keys get `keyringId: "imported"`
- **EIP-1193 impact** — `eth_accounts` and `eth_requestAccounts` continue to return only the active account's address. Switching accounts triggers `accountsChanged` event as before. DApps are unaware of the multi-keyring structure
