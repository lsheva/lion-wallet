# AGENTS.md — Lion Wallet

Single-file orientation for AI coding agents and new contributors. Read this before changing code so you don't have to crawl the tree.

For product positioning and design rationale see [`docs/PHILOSOPHY.md`](./docs/PHILOSOPHY.md). For coding conventions specific to this repo see [`docs/STYLE_GUIDE.md`](./docs/STYLE_GUIDE.md) (canonical, append-only) and the per-glob rules under [`.cursor/rules/`](./.cursor/rules/).

## Product

Lion Wallet is a free, open-source EVM wallet browser extension built natively for Safari, with cross-browser builds (Chrome/Firefox/Brave/Edge) sharing the same source. Self-custodial; no analytics, no telemetry, no accounts, no cloud sync. macOS uses the system Keychain (Touch ID); other platforms use a PBKDF2 + AES-GCM encrypted vault.

## Tech stack (source of truth: [package.json](./package.json))

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Solid.js** (`solid-js`) | Fine-grained signals; not React, not Preact |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | Compiled, no runtime |
| EVM | viem | Always derive selectors via `toFunctionSelector` — never hardcode 4-byte hex |
| Crypto | `@noble/hashes` | Pure JS, audited |
| Build | Vite (popup) + **Rolldown** (background/content/inpage) | See [scripts/build.ts](./scripts/build.ts) |
| Type-checker | **tsgo** (`@typescript/native-preview`) | Use `task typecheck`, not `tsc` |
| Lint + format | Biome | `task lint`, `task lint-fix`, `task format` |
| Package manager | **pnpm only** | See `packageManager` in `package.json` |
| Native | Swift / Xcode | Safari Web Extension container app under `xcode/` |

## Top-level layout

```
src/
  background/      MV3 service worker: vault, RPC, signing, approvals, activity
    handlers/      Message handlers grouped by domain (wallet, tokens, settings, ...)
  content/         Content script: page <-> background bridge
  inpage/          Injected provider: window.ethereum (EIP-1193 / EIP-6963)
  popup/           Solid UI: pages, components, store, router
    pages/         Route components (one per URL hash)
    components/    Reusable UI primitives + feature widgets
    store/         Per-domain signal stores (accounts, network, balance, activity)
  shared/          Types, constants, message protocol, formatters
scripts/           Build, icon generation, chain list generation
xcode/             Safari Web Extension Xcode project
brand/             Logo / icon source assets
```

## Message protocol (popup ↔ background)

Every popup→background call goes through:

```
popup           ->  sendMessage(msg)                        (src/shared/messages.ts)
runtime         ->  browser.runtime.onMessage              (src/background/index.ts)
background      ->  routeBackgroundMessage(msg)            (src/background/message-router.ts)
                ->  handlers/<domain>.handle<Verb>(args)   (src/background/handlers/*)
```

The protocol is a discriminated union in [`src/shared/messages.ts`](./src/shared/messages.ts):

- `MessageRequest` — every request shape (discriminated by `type`)
- `MessageDataMap` — per-`type` success-payload type
- `TypedResponse<T>` — typed `{ ok: true, data } | { ok: false, error }` per request

Add a new wallet RPC by editing **all five** in this order:

1. Add `{ type: "MY_NEW_RPC"; ... }` to `MessageRequest` in `src/shared/messages.ts`.
2. Add `MY_NEW_RPC: { result: ... }` to `MessageDataMap` in the same file.
3. Implement `handleMyNewRpc(...)` in the appropriate `src/background/handlers/<domain>.ts`.
4. Add a new entry to the `handlers` table in `src/background/message-router.ts`. The table is typed with `satisfies HandlerTable`, so missing entries are caught at compile time.
5. (Mock) Update `src/shared/messages-mock.ts` so `task dev-mock` works.

## Signing & approvals

dApp RPC calls that require signing land in the **pending approval queue** (`src/background/approval.ts`) and resolve when the user approves/rejects via the popup `/approve` route.

```
inpage provider          ->  RPC_REQUEST message            (EIP-1193)
background rpc-handler   ->  createPendingApproval(...)     (src/background/approval.ts)
popup `/approve`         ->  GET_PENDING_APPROVAL / ENRICH  (src/popup/pages/Approve.tsx)
user clicks approve      ->  APPROVE_REQUEST                (src/background/handlers/approval.ts)
                         ->  signing.* ->  resolvePendingApproval(...)
```

## Storage modes

Two mutually exclusive secret-storage backends live behind a single `StorageMode` (`src/background/vault.ts`):

- `keychain` (macOS) — mnemonic + imported private keys live in the system Keychain, gated by Touch ID per operation. Public account metadata is mirrored unencrypted in `browser.storage.local` so the popup renders without auth.
- `vault` — single PBKDF2(600k) + AES-GCM blob in `browser.storage.local`. Password required on every signing/export operation.

Most handler code that mutates state branches on `mode === "keychain"` early. The shared "load → mutate → persist" pattern is centralized in `src/background/wallet-internal.ts` (`mutateVaultByMode`, `persistFreshWallet`, `persistMergedVault`).

## Where to add things

| Task | Edit |
|---|---|
| New chain | `src/shared/constants.ts` (entries are also generated; see `scripts/gen-chains.ts`) |
| New RPC method handled by extension | See "Message protocol" above |
| New popup page | Add `src/popup/pages/MyPage.tsx`, register `<Route path="/my-page" .../>` in `src/popup/App.tsx` |
| New UI primitive | `src/popup/components/MyThing.tsx` |
| New cross-cutting helper | `src/shared/format.ts` (formatting), `src/shared/types.ts` (types), `src/popup/lib/local-cache.ts` (typed localStorage) |
| New ABI | `src/shared/abis.ts`. **Never** hardcode raw `0x...` selectors — derive via viem `toFunctionSelector` or import the named constant (e.g. `ERC20_TRANSFER_SELECTOR`). |

## Common commands

```bash
pnpm install
task dev                # Vite dev server for popup UI (extension stub via service worker)
task dev-mock           # popup-only dev with mocked background (no extension required)
task typecheck          # tsgo --noEmit (use this, not tsc)
task lint               # biome check
task lint-fix           # biome check --write
task build              # typecheck + popup + background bundles into dist/
task build-safari       # build extension + Xcode project under build/safari
task run-safari         # build-safari + open the container app
task build-chrome       # Chrome bundle (+ MV3 manifest)
```

Always run `task typecheck` and `task lint` before opening a PR.

## House rules (recap; canonical list lives in [`docs/STYLE_GUIDE.md`](./docs/STYLE_GUIDE.md))

- Use `pnpm` exclusively. Check [`Taskfile.yml`](./Taskfile.yml) before inventing new commands (`task --list`).
- Use `tsgo` (`task typecheck`) for type-checking, never raw `tsc`.
- Every `<button>` needs `type="button"`. Avoid `<div role="button">`.
- Avoid `array.find` for id lookups; build a `Map` once.
- Compare addresses with `eqAddress(a, b)` from `@shared/format` (or viem `isAddressEqual`), not `.toLowerCase()` on both sides.
- Persist user-facing addresses checksummed via viem `getAddress`; migrate lowercase entries on read.
- Never hardcode EVM 4-byte selectors. Derive with viem `toFunctionSelector` or use a named constant from `@shared/abis`.
- No new dependencies without explicit discussion (Philosophy principle 3 — "every dependency is a liability").
- No analytics, no telemetry, no tracking — ever.
- Always show a user-friendly error toast on failure (`showError(...)` from `@/toast`).

## Pointers

- Product & principles: [`docs/PHILOSOPHY.md`](./docs/PHILOSOPHY.md)
- Style rules (append-only): [`docs/STYLE_GUIDE.md`](./docs/STYLE_GUIDE.md)
- Roadmap & open work: [`docs/TODO.md`](./docs/TODO.md)
- Branding: [`docs/BRANDING.md`](./docs/BRANDING.md)
- Per-glob agent rules: [`.cursor/rules/`](./.cursor/rules/)
- Contribution flow: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Security model & disclosure: [`SECURITY.md`](./SECURITY.md)
