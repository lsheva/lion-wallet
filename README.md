<p align="center">
  <img src="brand/lion.svg" width="128" height="128" alt="Lion Wallet">
</p>

<h1 align="center">Lion Wallet</h1>

<p align="center"><strong>Your keys. Full clarity.</strong></p>

EVM-compatible cross-platform crypto wallet extension with first-class Safari support. Open source, zero tracking, lightweight by conviction.

## Why

The entire crypto wallet ecosystem is built around Chrome. Safari users — hundreds of millions across macOS, iOS, and iPadOS — have had zero reliable EVM wallet options. Lion Wallet fills that gap: built *for* Safari from day one using native Web Extension APIs, with cross-browser support (Chrome, Firefox, Brave, Edge) on the roadmap.

## Features

- **86 chains** — 49 mainnets, 36 testnets, plus Hardhat for local dev. All sourced from viem's chain definitions
- **EIP-1193 + EIP-6963** — standard dApp connectivity, MetaMask-compatible
- **Transaction decoding** — ABI decoding via Etherscan + 4byte.directory, transfer simulation, gas presets
- **Touch ID on macOS** — mnemonic and keys stored in the system Keychain, gated by biometrics. Password fallback for other platforms
- **No lock screen** — accounts and balances are always visible; authentication happens per-operation (signing, exporting)
- **Alchemy RPC support** — optional API key routes 26+ chains through Alchemy. Falls back to public RPCs
- **Privacy by absence** — no analytics, no telemetry, no crash reporters, no user accounts, no cloud sync

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Preact | 3 KB runtime vs React's 40 KB+ |
| State | Signals | Fine-grained updates, no VDOM diffing |
| Styling | Tailwind CSS v4 | Compiled away, zero runtime |
| EVM | viem | Type-safe, tree-shakeable |
| Crypto | @noble/hashes | Audited, pure JS |
| Build | Vite + esbuild | Sub-second builds |
| Types | tsgo | Native-speed type checking (Go port of tsc) |
| Native | Swift / Xcode | Safari Web Extension container app |

## Quick Start

```bash
pnpm install
pnpm dev           # Vite dev server for popup UI
pnpm build         # type-check + build to dist/
pnpm run:safari    # build + launch in Safari
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full setup, project structure, and code style guidelines.

## Security Model

**Keychain mode (macOS):** Mnemonic and private keys are stored in the macOS Keychain, scoped to the app, protected by Touch ID / system password on every retrieval. No additional encryption layer — the OS provides the vault.

**Vault mode (cross-platform fallback):** PBKDF2 (600k iterations) + AES-GCM encryption via Web Crypto API. Password required for each signing or export operation.

Keys are never held in memory beyond a single operation scope.

## Principles

1. **Transparency over profit** — no ads, no affiliate swaps, no partner tokens, no analytics
2. **Simplicity without sacrifice** — beginners send ETH in under a minute; developers inspect raw calldata
3. **Lightweight by conviction** — every dependency is a liability, every kilobyte is latency
4. **Performance is trust** — instant render, single-frame input response, no startup waterfall
5. **Privacy by absence** — no network requests except the ones you initiate
6. **Your keys, your responsibility** — self-custody is the entire point
7. **Platform-native security** — when the OS offers hardened infrastructure, use it

## License

GPL-3.0 — see [LICENSE](./LICENSE). Full design rationale in [PHILOSOPHY.md](./docs/PHILOSOPHY.md).
