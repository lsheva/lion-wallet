# Safari EVM Wallet — Development Log

> **This file is append-only.** After every coding iteration, append a new entry to the changelog below. Never edit or remove previous entries. Read this file at the start of a session to understand current state.

## Project

Minimal macOS Safari Web Extension acting as an EVM wallet. Preact + TypeScript + viem, bundled with Vite, wrapped in an Xcode Safari Web Extension project.

## Tech Stack

| Layer | Tech |
|---|---|
| UI | Preact + Tailwind CSS |
| Bundler | Vite (popup) + esbuild (background, content, inpage) |
| EVM | viem (accounts, signing, RPC, ABI) |
| Encryption | Web Crypto API (PBKDF2 + AES-GCM) |
| Storage | browser.storage.local |
| Extension | Manifest V3, Safari Web Extension |
| Native | Swift / Xcode (minimal container app) |

## Key Files

```
src/background/
  index.ts          — Service worker entry, message router, auto-lock
  wallet.ts         — Mnemonic generation, HD derivation, account state
  vault.ts          — AES-GCM encrypt/decrypt, PBKDF2 key derivation
  rpc-handler.ts    — EIP-1193 JSON-RPC method router, RPC proxy
  networks.ts       — Chain definitions, public client factory
  approval.ts       — Pending approval queue (resolve/reject callbacks)
  signing.ts        — Tx/message signing via viem, gas estimation presets

src/content/
  index.ts          — Injects inpage script, bridges page ↔ background

src/inpage/
  provider.ts       — EIP-1193 window.ethereum, EIP-6963 announcement

src/popup/
  App.tsx           — Preact router, pending approval check on mount
  pages/            — Welcome, SetPassword, SeedPhrase, ConfirmSeed, ImportWallet,
                      Unlock, Home, Send, Receive, TxApproval, SignMessage,
                      TxResult, SignResult, Settings, AutoLockTimer,
                      ExportPrivateKey, ShowRecoveryPhrase, AddToken, NetworkSelector
  components/       — Button, Input, Card, Header, Spinner, CopyButton, Identicon,
                      TokenRow, NetworkBadge, Tabs, Banner, BottomActions, Modal,
                      AddressDisplay
  mock/             — Mock state + DevToolbar for local dev
  styles/           — globals.css (Tailwind + theme tokens)

src/shared/
  messages.ts       — MessageRequest/Response unions, sendMessage helper
  types.ts          — SerializedAccount, VaultData, NetworkConfig, PendingApproval, GasPresets, etc.
  constants.ts      — NETWORKS array, DEFAULT_NETWORK_ID, AUTO_LOCK_TIMEOUT_MS

scripts/
  build.ts          — Vite build + esbuild entries + manifest copy
  icons.ts          — Generate extension & Xcode icons from SVG
```

## Status

**Phase 6 of 7 complete.** Phase 7 (Polish) remains.

---

## Changelog

### Phase 1 — Project Scaffold ✅

- Initialized pnpm project with TypeScript, Vite, Preact, viem, webextension-polyfill
- Vite config: multi-entry build (popup via Vite, background/content/inpage via esbuild)
- `manifest.json` (Manifest V3): service worker, content script on `<all_urls>`, popup
- Xcode project via `safari-web-extension-converter` in `xcode/`
- `scripts/build.ts` copies everything to `dist/`, `scripts/icons.ts` generates all icon sizes
- Extension loads in Safari with working popup

### Phase 2 — Encrypted Vault + Wallet Core ✅

- `vault.ts`: PBKDF2 (600k iterations) + AES-GCM encrypt/decrypt via Web Crypto API, stored in `browser.storage.local`
- `wallet.ts`: BIP-39 mnemonic generation, HD derivation (BIP-44 `m/44'/60'/0'/0/x`), private key import, in-memory unlocked state
- `networks.ts`: 8 pre-configured chains (Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche, Sepolia), public client cache
- Background service worker (`index.ts`): handles CREATE_WALLET, IMPORT_WALLET, UNLOCK, LOCK, GET_STATE, ADD_ACCOUNT, EXPORT_PRIVATE_KEY, EXPORT_MNEMONIC, GET_BALANCE, SWITCH_NETWORK
- Auto-lock after 5 min idle

### Phase 3 — Popup UI ✅

- Full Preact + Tailwind popup (360×600px) with preact-router
- Pages: Welcome, SetPassword, SeedPhrase, ConfirmSeed, ImportWallet, Unlock, Home, Send, Receive, Settings, AutoLockTimer, ExportPrivateKey, ShowRecoveryPhrase, AddToken, NetworkSelector
- Reusable components: Button, Input, Card, Header, Spinner, CopyButton, Identicon, TokenRow, NetworkBadge, Tabs, Banner, BottomActions, Modal, AddressDisplay
- Mock state layer (`mock/state.ts`, `mock/data.ts`) + DevToolbar for UI development
- Globals CSS with custom theme tokens, animations, SF Pro + JetBrains Mono fonts

### Phase 4 — EIP-1193 Provider + dApp Connection ✅

- `inpage/provider.ts`: EIP-1193 `window.ethereum` with `isMetaMask` compat flag, EventEmitter, `request()`, legacy `send()`/`sendAsync()`/`enable()`
- EIP-6963 provider announcement (`eip6963:announceProvider`)
- `content/index.ts`: injects inpage script, bridges `window.postMessage` ↔ `browser.runtime.sendMessage`
- `rpc-handler.ts`: routes `eth_requestAccounts`, `eth_accounts`, `eth_chainId`, `net_version`, `wallet_switchEthereumChain`, `wallet_addEthereumChain`, permissions — proxies unknown methods to chain RPC
- Origin tracking for connected dApps

### Phase 5 — Transaction + Message Signing ✅

- `approval.ts`: pending approval queue — stores one approval with resolve/reject callbacks, keeps the RPC response Promise open until user acts
- `signing.ts`: all signing via viem accounts — `sendTransaction`, `signTransaction`, `personalSign`, `ethSign`, `signTypedDataV4`; gas estimation with slow/normal/fast presets derived from base fee + priority fee
- RPC handler updated: signing methods (`eth_sendTransaction`, `eth_signTransaction`, `personal_sign`, `eth_sign`, `eth_signTypedData_v4`) create pending approval + open popup instead of returning error
- Background handles `GET_PENDING_APPROVAL` (returns approval + gas presets + account), `APPROVE_REQUEST` (executes signing), `REJECT_REQUEST`, `ESTIMATE_GAS`
- `App.tsx`: on mount checks for pending approvals, auto-routes to approval page
- `TxApproval.tsx`: shows to/from/value, 3-column gas speed selector (Slow/Normal/Fast with cost), collapsible details (gas limit, max fee, priority fee, base fee, raw data), confirm/reject
- `SignMessage.tsx`: shows method badge, decoded message (hex→text for personal_sign, formatted JSON for typed data), eth_sign warning, signing account
- `TxResult.tsx` / `SignResult.tsx`: display real tx hash or signature from sessionStorage
- Dev mode preserves mock-driven UI for local development

### Phase 6 — Send ETH/Tokens from Popup ✅

- **No new message types** — reuses existing `RPC_REQUEST` with `eth_sendTransaction` for both ETH and ERC-20 transfers
- `Send.tsx` rewritten: token selector dropdown (ETH + ERC-20s), recipient address validation via `isAddress`, amount input with live balance + MAX button
- ERC-20 transfers: encodes `transfer(address,uint256)` via viem `encodeFunctionData` + `erc20Abi`, sends as `eth_sendTransaction` to the token contract
- ETH transfers: standard `{ to, value }` params with `parseEther`
- Popup-originated requests: `rpc-handler.ts` recognizes `POPUP_ORIGIN`, skips dApp origin check, returns immediately after creating pending approval (so Send.tsx can navigate to TxApproval)
- `TxApproval.tsx`: detects popup origin — shows "Confirm Send" title, hides origin bar, reject navigates to `/home` instead of `window.close()`
- `TxResult.tsx`: real TX status tracking — polls `eth_getTransactionReceipt` + `eth_blockNumber` via existing RPC proxy, shows live confirmation count, detects reverts, links to block explorer
- Block explorer URLs added to all 8 pre-configured networks
- `Token` type updated with `decimals` field for proper ERC-20 amount parsing

### Bugfix — Network & Account Switching + New Chains

- **Account switching broken**: `store.ts` `switchAccount` only updated the local signal — never notified the background. Added `SWITCH_ACCOUNT` message type, background handler (calls `wallet.setActiveAccountIndex` + broadcasts `accountsChanged`), and updated `store.ts` to send the message
- **Network switching fragile**: `switchNetwork` had no error handling — if `sendMessage` threw, the UI state (signal update, modal close) was never reached. Moved signal updates before the `await` and wrapped the message in try/catch so the UI always reflects the switch
- **Added chains**: Arbitrum Sepolia (421614, `https://sepolia-rollup.arbitrum.io/rpc`) and Hardhat (31337, `http://127.0.0.1:8545`) added to `constants.ts`, `networks.ts` viemChains map, and mock data — all EVM-only
- Total pre-configured networks: 10 (Ethereum, Polygon, Arbitrum One, Optimism, Base, BSC, Avalanche, Sepolia, Arbitrum Sepolia, Hardhat)

### ETH Node Configuration — Alchemy RPC Provider Key

- **Global Alchemy RPC key**: optional API key stored in `browser.storage.local` as `rpcProviderKey`. When set, all supported chains route through Alchemy (`https://{slug}.g.alchemy.com/v2/{key}`). When not set, viem's built-in chain defaults are used (public RPCs)
- **Supported chains**: Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, Sepolia, Arbitrum Sepolia. BSC and Hardhat use their own defaults
- **`networks.ts`**: added `ALCHEMY_CHAIN_SLUGS` mapping, in-memory key cache (`loadRpcProviderKey` / `setRpcProviderKeyInMemory`), `getRpcUrl()` helper. `getPublicClient` now uses `getRpcUrl()` — passing `undefined` makes viem use the chain's default transport. Client cache clears when key changes
- **`signing.ts`**: `getWalletClient` updated to use `getRpcUrl()` instead of hardcoded `network.rpcUrl`
- **`messages.ts`**: added `GET_RPC_PROVIDER_KEY` and `SET_RPC_PROVIDER_KEY` message types
- **`index.ts`**: new message handlers for get/set, calls `loadRpcProviderKey()` on startup
- **Onboarding (`ApiKeySetup.tsx`)**: expanded to two cards — "RPC Provider" (Alchemy) and "Block Explorer" (Etherscan). Each has a "Need a key?" accordion with setup steps and direct links to provider dashboards. Both optional, Continue saves whatever was entered
- **Settings (`Settings.tsx`)**: "API Keys" card now shows both Alchemy RPC Key and Etherscan API Key as separate rows with edit/remove. Each editing state includes a "Get a key" link to the relevant dashboard
- **Tx decoder metadata**: `decodeTx` now returns `{ decoded, via }` where `via` is `"etherscan" | "4byte" | "selector" | null`. `simulateTx` returns `{ transfers, via }` where `via` is `"trace" | "fallback"`
- **Approval page hints**: `GET_PENDING_APPROVAL` response includes `decodedVia`, `simulatedVia`, `hasEtherscanKey`, `hasRpcProviderKey`. When an API key is missing and would have improved the result, a subtle inline hint appears on the tx approval page linking to Settings

### Toolchain — Migrate to tsgo (Go-based TypeScript compiler)

- **Replaced `tsc` with `tsgo`** for type checking via `@typescript/native-preview` (v7.0.0-dev.20260319.1) — the native Go port of the TypeScript compiler by Microsoft
- **`package.json`**: `build` script changed from `tsc -b` to `tsgo --noEmit`; added dedicated `typecheck` script (`tsgo --noEmit`)
- **`tsconfig.json`**: removed deprecated `baseUrl` option; updated `paths` values to use relative `./` prefixes (required by tsgo/TS7)
- **Performance**: type checking ~4.3x faster (0.9s vs 4.0s on this codebase)
- **`typescript` (5.9.3) retained** as dev dependency for IDE/editor language service support
- Deleted stale `tsconfig.tsbuildinfo`; added `*.tsbuildinfo` to `.gitignore`
