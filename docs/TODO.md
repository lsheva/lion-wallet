[x] - integration with keychain to store the password and keys securely
[] - calls that fail to be mined within some time due to low gas or other error should be retried, maybe with a larger gas
[] - if there is a failed call and new call is submitted, ask the user if they want to retry or replace the existing call. Make sure to only do this if the new call is for the same account and network. If during submitting the new call the old one propagated on chain first, then show a notification that old call successful, and the new one should be retried (with higher nonce)
[] - allow cancelling a call that is yet to be mined, show confirmation if cancellation is successful or not.

## Connection approval prompt

When a dApp calls `eth_requestAccounts` for the first time, show an approval popup instead of auto-connecting. Currently any site can silently obtain the active account address.

### Behavior

- First `eth_requestAccounts` from an origin → open approval popup showing site origin, favicon, and requested permissions
- User approves → origin is added to connected set, accounts returned
- User rejects → `4001 User Rejected Request` error returned to dApp
- Approved origins persisted in `browser.storage.local` and survive browser restart
- Settings → Connected Sites: list all approved origins with ability to revoke
- Revoking disconnects immediately and emits `accountsChanged([])` to the dApp

### Steps

[] - add connected origins storage (persistent, not just in-memory Set)
[] - intercept `eth_requestAccounts` — check storage, show approval popup if origin unknown
[] - build connection approval UI: origin, favicon, approve/reject buttons
[] - emit `accountsChanged` / `disconnect` events on revoke
[] - add Settings → Connected Sites page with revoke per-origin
[] - handle re-connection after revoke (re-prompts approval)

## Optional lock screen

Auto-lock the wallet after a configurable inactivity period. When locked, the popup shows a lock screen requiring authentication (Touch ID or password) before any interaction. Disabled by default — users opt in via Settings.

### Behavior

- **Off by default** — wallet stays unlocked indefinitely (current behavior)
- **When enabled**, user picks a TTL: 1 min, 5 min, 15 min, 30 min, 1 hour, or custom
- Inactivity = no popup interaction (mouse, keyboard, touch). Background activity (pending txs, RPC) doesn't count
- On lock: popup renders a lock screen overlay. No account data visible, no actions available
- Unlock via Touch ID (Keychain mode) or password entry (Vault mode)
- Lock state stored in `browser.storage.session` — survives popup close but not browser restart
- Last-activity timestamp tracked in session storage, checked on popup open

### UI

- Lock screen: centered lion icon, "Wallet locked" text, unlock button (Touch ID) or password field
- Settings → Security: "Auto-lock" toggle with TTL dropdown
- Manual lock button in Settings for immediate locking

### Steps

[] - add lock settings to storage (enabled: boolean, ttlMs: number)
[] - add Settings → Security UI: auto-lock toggle + TTL picker
[] - track last-activity timestamp in session storage (update on user interaction events)
[] - add lock check on popup mount: compare now vs lastActivity, lock if expired
[] - build lock screen component with Touch ID / password unlock
[] - add manual "Lock now" button to Settings
[] - ensure locked state blocks all message sending from popup (except unlock)

## Cross-platform Rust native signing

Move private key management and signing out of JS into a Rust native host. The private key never enters JS memory — JS hashes/encodes the transaction, sends the 32-byte digest to Rust, Rust signs with secp256k1 and returns (r, s, v).

### Architecture

- **Rust core library** — single codebase for all platforms
  - secp256k1 ECDSA signing (k256 or libsecp256k1 crate)
  - BIP-39 mnemonic handling, BIP-44 key derivation
  - Platform-specific secure storage behind a trait:
    - macOS: Keychain (Security.framework via security-framework crate)
    - Windows: Credential Manager (windows-credentials crate)
    - Linux: libsecret / encrypted file fallback
  - JSON message protocol: receives `{action, payload}`, returns `{ok, data/error}`

- **Platform entry points**
  - macOS + Safari: thin Swift shim calls Rust static lib via C FFI (Apple requires NSExtensionRequestHandling)
  - macOS + Chrome/Firefox: standalone Rust binary, stdin/stdout native messaging
  - Windows + Chrome/Firefox/Edge: standalone Rust .exe, stdin/stdout + registry manifest
  - Linux + Chrome/Firefox: standalone Rust binary, stdin/stdout + JSON manifest

- **Biometric auth — asked during onboarding, must explicitly decline**
  - During wallet creation/import, a dedicated step asks: "Secure with biometric auth?" with two clear choices
    - "Use Touch ID / Windows Hello" → stores mnemonic in native secure storage, signs via Rust
    - "Use password instead" → stores mnemonic in encrypted JS vault (current behavior)
  - User must explicitly pick one — no silent default, no skipping
  - Choice is stored in browser.storage.local and can be changed later in Settings → Security
  - On disable later: mnemonic migrates back to JS vault, native store is cleared
  - If native host unavailable at onboarding (not installed), biometric option is hidden or shows "Install companion app" link
  - If native host becomes unavailable after setup, auto-fallback to vault with a notification prompting re-setup

- **JS extension changes**
  - Stop retrieving mnemonic/private key to JS only when native signing is enabled
  - signing.ts: check storage mode — if native, send pre-hashed digest via sendNativeMessage; if vault, use current JS signing path
  - Settings UI: toggle for "Use biometric authentication" with platform-aware messaging (Touch ID / Windows Hello / device password)

### Steps

[] - scaffold Rust workspace (native-host/) with core lib + platform binaries
[] - implement secure storage trait with macOS Keychain backend
[] - implement secp256k1 signing: accept 32-byte hash, return (r, s, v) signature
[] - implement BIP-39/BIP-44 key derivation in Rust (mnemonic → private key stays in Rust)
[] - implement stdin/stdout native messaging protocol for Chrome/Firefox
[] - build Swift FFI bridge: replace current SafariWebExtensionHandler keychain logic with calls to Rust lib
[] - refactor JS signing.ts: send pre-hashed digest to native host, assemble signed tx from returned signature
[] - add Windows Credential Manager backend
[] - add Linux libsecret backend with encrypted file fallback
[] - create installers: .msi (Windows), .deb/.rpm (Linux), homebrew formula (macOS for Chrome)
[] - add native host availability detection + graceful fallback to JS vault signing in extension
[] - add biometric vs password choice step to onboarding (create wallet + import wallet flows)
[] - implement mnemonic migration flow: vault → native store and native store → vault (for switching in Settings)
[] - add Settings → Security page to change auth method after onboarding
[] - auto-fallback: detect native host unavailability at signing time, revert to vault mode with user notification

## ERC-4337 smart contract wallet with Secure Enclave signing

True hardware-enclave signing for Ethereum. The P-256 private key lives inside the Secure Enclave (macOS/iOS) or TPM (Windows) and never leaves the hardware — the enclave signs directly. No mnemonic, no software key.

### How it works

- User creates a smart contract wallet (counterfactual deployment via factory)
- P-256 key pair is generated inside Secure Enclave / TPM — private key is non-extractable
- The smart contract wallet's validation logic verifies P-256 signatures instead of secp256k1
- On-chain P-256 verification via RIP-7212 precompile (live on Base, Optimism, Arbitrum, Polygon) or Solidity verifier fallback
- Transactions are submitted as UserOperations to an ERC-4337 bundler

### Architecture

- **Account types**: wallet supports both EOA (secp256k1, existing) and Smart Account (P-256, new)
  - User chooses account type during onboarding
  - EOA accounts use Rust native signing (secp256k1) or JS vault — existing flow
  - Smart Accounts use Secure Enclave / TPM for P-256 signing — new flow

- **On-chain contracts**
  - Wallet factory: deploys minimal proxy smart wallets per user
  - Wallet contract: ERC-4337 compatible, validates P-256 signatures via RIP-7212 or Solidity P-256 verifier
  - Consider using established implementations (Safe, Kernel, or Coinbase Smart Wallet contracts)

- **Signing flow**
  - JS builds the UserOperation (calldata, gas limits, paymaster, etc.)
  - Sends the UserOperation hash to native host (Swift/Rust)
  - Native host calls Secure Enclave / TPM to sign with P-256 — key never leaves hardware
  - Returns P-256 signature (r, s) to JS
  - JS submits signed UserOperation to bundler

- **Bundler & paymaster**
  - Need an ERC-4337 bundler endpoint per supported chain (self-hosted or third-party: Pimlico, Alchemy, Stackup)
  - Optional paymaster for gas sponsorship (lets users transact without ETH for gas)

- **Chain support**
  - RIP-7212 chains (Base, OP, Arbitrum, Polygon): cheap P-256 verification (~3.5k gas)
  - Other EVM chains: Solidity P-256 verifier fallback (~300k gas, but functional)
  - EOA fallback on chains without ERC-4337 entrypoint

### Steps

[] - research and choose base smart account implementation (Safe, Kernel, Coinbase, or custom)
[] - deploy or integrate wallet factory + P-256 validation contracts on target chains
[] - add Secure Enclave P-256 key generation and signing to native host (Swift for macOS, Rust+TPM for Windows)
[] - implement UserOperation building in JS (calldata encoding, gas estimation, nonce management)
[] - integrate ERC-4337 bundler (Pimlico/Alchemy/Stackup) for UserOperation submission
[] - add Smart Account type to onboarding: "Hardware-secured account (recommended)" vs "Standard account"
[] - implement account recovery strategy (social recovery, backup key, or guardian-based)
[] - handle cross-chain smart account deployment (counterfactual addresses, factory on each chain)
[] - add paymaster integration for optional gas sponsorship
[] - UI: distinguish Smart Account vs EOA in account list, show security level indicator

[] - batch token sending (for privatekey and smartcontract wallets)