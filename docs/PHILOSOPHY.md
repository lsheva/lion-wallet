# Lion Wallet

**Your keys. Full clarity.**

Lion Wallet is a free, open-source EVM wallet built natively for Safari. It exists because using a wallet should feel like looking through clean glass — you see exactly what's happening, nothing is hidden, and nothing is trying to sell you something.

## Why This Exists

**There is no reliable EVM wallet for Safari.**

The entire crypto wallet ecosystem is built around Chrome. MetaMask, Rabby, Rainbow — they're all Chromium-first. Safari users are either ignored entirely or offered half-hearted ports that break on updates, lack platform integration, and feel foreign on macOS and iOS. Some wallets dropped Safari support altogether. Others never started.

This isn't a niche problem. Safari is the default browser on every Mac, iPhone, and iPad. Hundreds of millions of people use it daily. Yet if you want to interact with Ethereum or any EVM chain from Safari, your options range from nonexistent to unreliable.

Lion Wallet fills that gap. It's built *for* Safari from day one — not ported to it as an afterthought. It uses native Safari extension APIs, follows Apple platform conventions, and treats macOS and iOS as first-class targets.

**But Lion Wallet won't stop at Safari.** The architecture is browser-agnostic by design. The same codebase will ship as extensions for Chrome, Firefox, Brave, and Edge. Safari is where Lion Wallet starts because that's where the need is most urgent — but the goal is a single, trustworthy wallet that works everywhere you browse.

## Name

**Lion** — memorable, approachable, tied to the safari landscape and Apple’s own big-cat era. The product is **Lion Wallet**: one word for the brand, two for what it is.

The name still reflects clarity: nothing hidden, no mystery about where your data goes (nowhere), no hidden fees or dark patterns. Just a clear view of your assets and the blockchain.

## Core Principles

### 1. Transparency over profit

Lion Wallet will never run ads, inject affiliate swaps, promote partner tokens, or collect analytics. The code is open source — every line is auditable. There is no business model because Lion Wallet is not a business. It's a tool.

### 2. Simplicity without sacrifice

A beginner should be able to send ETH in under a minute. A developer should be able to inspect raw calldata, decode function signatures, and simulate transactions. These aren't competing goals — they're layers. The simple surface doesn't hide the depth; it organizes it.

### 3. Lightweight by conviction

Every dependency is a liability. Every kilobyte is latency. Lion Wallet treats bundle size and runtime overhead as first-class concerns — not things to optimize later, but constraints that shape every decision from the start. Preact over React. Signals over reducers. Tailwind over runtime CSS-in-JS. No heavy abstraction layers, no framework tourism. The extension should load before you finish clicking the icon.

### 4. Performance is trust

A wallet that stutters feels broken. A wallet that feels broken feels unsafe. Lion Wallet renders instantly, responds to input within a single frame, and never blocks the main thread with work the user didn't ask for. There are no background analytics, no lazy-loaded ad SDKs, no startup waterfalls. Cold start is fast because there's nothing to warm up.

### 5. Privacy by absence

The strongest privacy policy is having nothing to track. Lion Wallet makes no network requests except the ones you initiate (RPC calls, price lookups). There are no analytics endpoints, no crash reporters phoning home, no session fingerprinting. Your activity is yours.

### 6. Your keys, your responsibility

Lion Wallet stores keys encrypted on-device. It never transmits seed phrases or private keys. It provides clear export and backup flows so users understand what they're protecting. Self-custody is not a feature — it's the entire point.

### 7. Platform-native security

When the operating system offers hardened security infrastructure — Keychain, biometrics, secure enclave — Lion Wallet uses it. On macOS, the mnemonic and private keys live in the system Keychain, scoped to the app and gated by Touch ID. No extra encryption layer, no redundant password — the OS provides the vault. On platforms without these primitives, the same keys are encrypted with a user password using PBKDF2 + AES-GCM. Platform security is always additive and never required; the wallet works correctly either way.

## What Lion Wallet Is Not

- **Not a DeFi aggregator.** No built-in swaps, bridges, or staking. Lion Wallet connects you to dApps; it doesn't replace them.
- **Not a data product.** No tracking, no telemetry, no user accounts, no cloud sync.
- **Not a walled garden.** Open source under a permissive license. Fork it, audit it, improve it.
- **Not VC-funded.** No investors to appease, no growth metrics to chase, no token launch on the roadmap.
- **Not bloatware.** No Electron shell, no bundled browser, no 50MB extension download. Lion Wallet ships what it needs and nothing more.

## Who It's For

- **Beginners** who want a wallet that doesn't overwhelm them with DeFi promotions the moment they open it.
- **Developers** who want transaction decoding, raw calldata inspection, and a wallet that stays out of their way during testing.
- **Privacy-conscious users** who are tired of wallets that harvest behavioral data.
- **Safari users** who have had zero reliable options in a Chrome-dominated wallet ecosystem.
- **Cross-browser users** who want one wallet that works the same everywhere — Safari today, Chrome, Firefox, Brave, and Edge next.

## Design Language

- **Clean and native.** The UI follows platform conventions — system fonts, familiar spacing, iOS-style affordances. It should feel like it belongs on macOS and iOS, not like a Chrome extension that was ported over.
- **Indigo accent** (`#6366F1`) — calm, focused, professional. Not flashy, not corporate.
- **Monospace for addresses** (JetBrains Mono) — technical content is displayed with technical typography.
- **Lion mark** — see [`BRANDING.md`](./BRANDING.md). The paw and full lion assets communicate the brand at toolbar and app-icon sizes.

## Technical Identity

Every choice is made with weight and speed in mind. If a lighter alternative exists and doesn't sacrifice correctness, Lion Wallet uses it.

| Layer        | Choice          | Why                                      |
|------------- |---------------- |----------------------------------------- |
| Framework    | Preact          | 3KB runtime vs React's 40KB+, same API   |
| State        | Signals         | Fine-grained updates, no virtual DOM diffing overhead |
| Styling      | Tailwind CSS v4 | Compiled away at build time, zero runtime |
| EVM          | viem            | Type-safe, tree-shakeable, no legacy bloat |
| Crypto       | @noble/hashes   | Audited, pure JS, no native bindings     |
| Build        | Vite + esbuild  | Sub-second builds, aggressive tree-shaking |
| Types        | tsgo            | Native-speed type checking, 10x faster than tsc |

## The Promise

Lion Wallet will stay free. It will stay open source. It will never track you. It will never show you ads. It will never sell your attention. If it ever breaks these promises, fork it — the code is yours.
