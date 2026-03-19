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
