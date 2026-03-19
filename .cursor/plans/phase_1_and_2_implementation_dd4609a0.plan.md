---
name: Phase 1 and 2 Implementation
overview: Implement Phase 1 (project scaffold, multi-entry build, manifest.json, Xcode project, build script) and Phase 2 (encrypted vault with PBKDF2+AES-GCM, HD wallet core with viem, background service worker with message handling) for the Safari EVM Wallet extension.
todos:
  - id: deps
    content: Add viem and webextension-polyfill dependencies
    status: completed
  - id: manifest
    content: Create src/manifest.json (Manifest V3 for Safari)
    status: completed
  - id: build-pipeline
    content: Reconfigure vite.config.ts, create scripts/build.ts, update package.json scripts
    status: completed
  - id: stubs
    content: "Create stub entry files: background/index.ts, content/index.ts, inpage/provider.ts"
    status: completed
  - id: tsconfig-env
    content: Update tsconfig.json path aliases and src/env.d.ts browser types
    status: completed
  - id: shared
    content: Create src/shared/ — types.ts, messages.ts, constants.ts
    status: completed
  - id: vault
    content: Implement src/background/vault.ts (PBKDF2 + AES-GCM encryption)
    status: completed
  - id: wallet
    content: Implement src/background/wallet.ts (mnemonic generation, HD derivation, key import via viem)
    status: completed
  - id: networks
    content: Implement src/background/networks.ts (chain management, RPC client factory)
    status: completed
  - id: service-worker
    content: Implement src/background/index.ts (message handler, lock/unlock lifecycle, auto-lock timer)
    status: completed
  - id: xcode
    content: Generate Xcode project with safari-web-extension-converter, update .gitignore
    status: completed
  - id: verify-build
    content: Verify pnpm dev still works and pnpm build:ext produces correct dist/ output
    status: completed
isProject: false
---

# Phase 1 + Phase 2: Scaffold and Wallet Core

## Current State

- Popup UI is fully built in `src/popup/` with 18 routes, components, and mock data (`src/popup/mock/`)
- Vite is configured for popup-only SPA build (root: `src/popup`)
- No `manifest.json`, no `src/background/`, no `src/content/`, no `src/inpage/`, no `src/shared/`, no `xcode/`, no `scripts/`
- Dependencies: Preact, preact-router, preact-signals, lucide-preact, qrcode, @noble/hashes
- Missing: `viem`, `webextension-polyfill`

---

## Phase 1: Project Scaffold + Build Pipeline

### 1.1 Add Dependencies

```bash
pnpm add viem webextension-polyfill
pnpm add -D @anthropic-ai/sdk  # NO -- just webextension-polyfill has its own types
```

Actual installs:

- **Runtime**: `viem` (EVM interactions, HD wallet, signing), `webextension-polyfill` (typed `browser.` API)
- **Dev**: no new dev deps needed (`webextension-polyfill` ships its own TS types)

### 1.2 Create `src/manifest.json`

Manifest V3 for Safari with:

- `action.default_popup` pointing to `popup/index.html`
- `background.service_worker` pointing to `background.js` with `"type": "module"`
- `content_scripts` entry for `content-script.js` at `document_start`
- `web_accessible_resources` for `inpage.js`
- `permissions`: `["storage", "activeTab"]`

### 1.3 Reconfigure Build Pipeline

**Problem**: Popup needs Vite's HTML entry + Preact + Tailwind, while background/content/inpage need single-file IIFE bundles with no code splitting.

**Solution**: Two-stage build orchestrated by `scripts/build.ts` (Node.js TypeScript):

1. **Popup** -- standard Vite build via `vite.build()` API with `outDir: dist/popup`
2. **Scripts** -- esbuild (bundled with Vite, zero extra deps) for background, content, inpage as IIFE bundles into `dist/`
3. **Manifest** -- copy `src/manifest.json` to `dist/`

Modify [vite.config.ts](vite.config.ts):

- Change `build.outDir` from `dist` to `dist/popup` so popup assets land in `dist/popup/`
- Keep `root: "src/popup"` for dev server compatibility

Create `scripts/build.ts` — pure API, no child processes:

```typescript
import { rmSync, cpSync, existsSync } from "node:fs";
import { build as viteBuild } from "vite";
import { build as esbuild } from "esbuild";

// Clean
rmSync("dist", { recursive: true, force: true });

// 1. Build popup (Vite API — loads vite.config.ts automatically)
await viteBuild();

// 2. Build extension scripts (esbuild API)
const shared = { bundle: true, platform: "browser" as const, target: "es2020" };
await Promise.all([
  esbuild({
    ...shared,
    entryPoints: ["src/background/index.ts"],
    outfile: "dist/background.js",
    format: "esm",
  }),
  esbuild({
    ...shared,
    entryPoints: ["src/content/index.ts"],
    outfile: "dist/content-script.js",
    format: "iife",
  }),
  esbuild({
    ...shared,
    entryPoints: ["src/inpage/provider.ts"],
    outfile: "dist/inpage.js",
    format: "iife",
  }),
]);

// 3. Copy manifest
cpSync("src/manifest.json", "dist/manifest.json");

// 4. Copy to Xcode resources (if project exists)
const xcodeResources = "xcode/SafariEVMWallet/SafariEVMWallet Extension/Resources";
if (existsSync(xcodeResources)) {
  rmSync(xcodeResources, { recursive: true, force: true });
  cpSync("dist", xcodeResources, { recursive: true });
}

console.log("Build complete.");
```

Add `package.json` scripts:

- `"build:ext"`: `"node --experimental-strip-types scripts/build.ts"`
- Keep `"dev"` as-is for popup dev server

### 1.4 Update TypeScript Config

Update [tsconfig.json](tsconfig.json):

- Add path alias `"@shared/*": ["src/shared/*"]`
- Ensure `"include": ["src"]` covers all new directories (it already does)
- Add `"webextension-polyfill"` type awareness via the import (no tsconfig change needed)

Update [src/env.d.ts](src/env.d.ts) to declare the `browser` global for Safari context.

### 1.5 Create Stub Entry Files

- `src/background/index.ts` -- minimal service worker that logs "background loaded" and listens for `browser.runtime.onMessage`
- `src/content/index.ts` -- minimal content script that logs "content script loaded"
- `src/inpage/provider.ts` -- minimal injected script (placeholder `window.ethereum = {}`)

### 1.6 Create Xcode Project

After first successful `pnpm run build:ext`, generate the Xcode project:

```bash
xcrun safari-web-extension-converter dist/ \
  --project-location xcode/ \
  --app-name "SafariEVMWallet" \
  --bundle-identifier dev.wallet.SafariEVMWallet \
  --swift \
  --macos-only \
  --no-open
```

Update `.gitignore` to exclude Xcode build artifacts (`xcode/**/build/`, `*.xcuserstate`, etc.).

### 1.7 Verify

- `pnpm run dev` still works for popup development
- `pnpm run build:ext` produces `dist/` with: `popup/index.html`, `popup/assets/...`, `background.js`, `content-script.js`, `inpage.js`, `manifest.json`
- Extension loads in Safari via the Xcode project (manual verification)

---

## Phase 2: Encrypted Vault + Wallet Core

### 2.1 Shared Types and Messages

Create `src/shared/types.ts`:

- `SerializedAccount` -- `{ name, address, path, index }`
- `VaultData` -- `{ mnemonic: string, accounts: SerializedAccount[], activeAccountIndex: number }`
- `NetworkConfig` -- promote existing `Network` type from mock/data.ts

Create `src/shared/messages.ts` -- typed request/response protocol for popup-to-background communication:

- `CREATE_WALLET` -- create new wallet with password, returns mnemonic
- `IMPORT_WALLET` -- import mnemonic + password
- `IMPORT_PRIVATE_KEY` -- import raw private key
- `UNLOCK` -- unlock vault with password
- `LOCK` -- lock vault
- `GET_STATE` -- get current wallet state (locked/unlocked, accounts, active network)
- `GET_ACCOUNTS` -- list accounts
- `ADD_ACCOUNT` -- derive next HD account
- `GET_BALANCE` -- get ETH balance for active account
- `SWITCH_NETWORK` -- change active network
- `EXPORT_PRIVATE_KEY` -- export key (requires password confirmation)
- `EXPORT_MNEMONIC` -- export seed phrase (requires password confirmation)

Create `src/shared/constants.ts`:

- Move `NETWORKS` array from [src/popup/mock/data.ts](src/popup/mock/data.ts) here (shared between background and popup)
- Default settings (auto-lock timeout, default network)

### 2.2 Implement `src/background/vault.ts`

The vault encrypts sensitive data (mnemonic + private keys) at rest in `browser.storage.local`.

Key operations using **Web Crypto API**:

- `deriveKey(password, salt)` -- PBKDF2 with 600,000 iterations, SHA-256, returns AES-GCM-256 key
- `encrypt(data, password)` -- generate random salt (32 bytes) + IV (12 bytes), encrypt with AES-GCM, store `{ salt, iv, ciphertext }` as base64 in `browser.storage.local`
- `decrypt(password)` -- read from storage, derive key from salt + password, decrypt ciphertext
- `isVaultInitialized()` -- check if encrypted data exists in storage
- `clearVault()` -- wipe storage

Storage format in `browser.storage.local`:

```json
{
  "vault": { "salt": "base64...", "iv": "base64...", "ciphertext": "base64..." }
}
```

### 2.3 Implement `src/background/wallet.ts`

Wallet management using **viem/accounts**:

- `createWallet()` -- `generateMnemonic(english)`, returns mnemonic string
- `deriveAccount(mnemonic, index)` -- `mnemonicToAccount(mnemonic, { addressIndex: index })`, returns `{ address, path }`
- `importFromPrivateKey(key)` -- `privateKeyToAccount(key)`, returns address
- `getPrivateKey(mnemonic, index)` -- derive HD key and extract private key for export
- `signTransaction(account, tx)` -- sign using viem's account signer
- `signMessage(account, message)` -- sign using viem's account signer

In-memory state (cleared on lock):

- Decrypted mnemonic (only while unlocked)
- Derived accounts array
- Active account index

### 2.4 Implement `src/background/networks.ts`

- Import `NETWORKS` from `@shared/constants`
- `getActiveNetwork()` / `setActiveNetwork(chainId)` -- persisted in `browser.storage.local` (unencrypted, not sensitive)
- `getPublicClient(chainId)` -- create viem `PublicClient` for RPC calls (used later in Phase 4+)

### 2.5 Implement `src/background/index.ts` (Service Worker)

The service worker is the central coordinator:

```
browser.runtime.onMessage listener:
  match message.type:
    CREATE_WALLET  -> wallet.createWallet() -> vault.encrypt(vaultData, password) -> respond
    IMPORT_WALLET  -> vault.encrypt(vaultData, password) -> respond
    UNLOCK         -> vault.decrypt(password) -> load accounts into memory -> respond
    LOCK           -> clear in-memory keys -> respond
    GET_STATE      -> respond with { isUnlocked, accounts, activeNetwork }
    GET_ACCOUNTS   -> respond with accounts list
    ADD_ACCOUNT    -> derive next index -> update vault -> respond
    SWITCH_NETWORK -> networks.setActiveNetwork() -> respond
    EXPORT_*       -> verify password -> respond with key/mnemonic
    ...
```

Auto-lock: idle timer using `setTimeout` that calls `lock()` after configurable timeout (default 5 min). Reset on each message received.

### 2.6 Update tsconfig Path Aliases

Add `@shared/*` alias so both popup and background code can import from `src/shared/`.

---

## File Creation Summary

**Phase 1** (new files):

- `src/manifest.json`
- `src/background/index.ts` (stub)
- `src/content/index.ts` (stub)
- `src/inpage/provider.ts` (stub)
- `scripts/build.ts`

**Phase 1** (modified files):

- [package.json](package.json) -- add deps + scripts
- [vite.config.ts](vite.config.ts) -- change outDir to `dist/popup`
- [tsconfig.json](tsconfig.json) -- add `@shared/` path alias
- [src/env.d.ts](src/env.d.ts) -- add browser global type
- [.gitignore](.gitignore) -- add Xcode artifacts

**Phase 2** (new files):

- `src/shared/types.ts`
- `src/shared/messages.ts`
- `src/shared/constants.ts`
- `src/background/vault.ts`
- `src/background/wallet.ts`
- `src/background/networks.ts`

**Phase 2** (modified files):

- `src/background/index.ts` -- full message handler implementation

**Not modified** (Phase 3 popup stays on mock data for now; wiring popup to real background happens incrementally in later work)
