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

## Reset Wallet

Add a "Reset Wallet" button to Settings that wipes all data (mnemonic, accounts, imported keys, cached activity, API keys, preferences) and returns the user to the onboarding screen. The backend handler (`handleResetWallet`) already exists — this is primarily a UI task with a confirmation flow.

**Why "Reset Wallet" and not "Logout" or "Remove Account":**
- "Logout" implies a session — there's no server, no session to end. The data is destroyed, not signed out of.
- "Remove Account" suggests deleting one account from a multi-account wallet. That's a separate, less destructive feature.
- "Reset Wallet" is the industry standard (MetaMask, Rabby, etc.) and clearly communicates the irreversible action.

### Confirmation flow

Resetting is destructive and irreversible. The confirmation must make this extremely clear:

1. User taps "Reset Wallet" in Settings (styled as a danger action at the bottom of the page)
2. First confirmation modal:
   - Warning icon + "Reset Wallet?" heading
   - Text: "This will permanently delete your recovery phrase, all accounts, and all settings from this device. If you haven't backed up your recovery phrase, your funds will be lost forever."
   - Two buttons: "Cancel" (primary) and "Reset" (danger, secondary)
3. Second confirmation — type to confirm:
   - Input field: "Type RESET to confirm"
   - "Reset Wallet" button only enabled when input matches
4. On confirm: call `RESET_WALLET` message, clear all local state, redirect to onboarding

### What gets wiped

- Mnemonic (keychain or encrypted vault)
- All derived and imported account keys
- Account metadata (names, derivation indices)
- Active network selection
- Cached activity and token data
- API keys (Alchemy, Etherscan)
- Theme preference
- Any pending approval requests

### Steps

[] - add "Reset Wallet" danger button to Settings page (below all other sections)
[] - build two-step confirmation modal (warning + type-to-confirm)
[] - on confirm: send `RESET_WALLET` message, clear popup local state (localStorage, signals), redirect to onboarding
[] - ensure all storage is actually cleared (verify keychain cleanup, vault, browser.storage.local, session storage)

## Remove Individual Account

Separate from full reset — allow removing a single account from the wallet without touching the mnemonic or other accounts. Useful for cleaning up unused derived accounts or removing an imported private key.

### Behavior

- Each account row in Settings → Accounts gets a remove/delete action (icon or swipe)
- Cannot remove the last remaining account — show a hint to use "Reset Wallet" instead
- For derived accounts (BIP-44): removes the account metadata only; the mnemonic stays, and the user can re-derive the same index later via "Add Account"
- For imported private keys: deletes the key from keychain/vault permanently; warn that re-import requires the private key again
- After removal, if the active account was removed, switch to the first remaining account
- Confirmation required: "Remove Account 2 (0x1234…abcd)?" with a warning about imported keys being permanently deleted

### Steps

[] - add `REMOVE_ACCOUNT` message type and backend handler (delete key for imported, remove metadata for derived)
[] - add delete action to account rows in Settings (trash icon or swipe-to-delete)
[] - prevent removing the last account (disable button, show tooltip)
[] - add confirmation modal with different wording for derived vs imported accounts
[] - handle active account removal: auto-switch to first remaining account, broadcast `accountsChanged`

## Active address discovery after mnemonic import

After importing a mnemonic, detect which derived addresses (BIP-44 m/44'/60'/0'/0/i) have balances or activity. Discovery is lazy and per-chain — the wallet pre-derives a global list of addresses upfront (cheap, no RPC), but only checks balances on a given chain when the user actually opens it. This avoids hitting dozens of RPCs during onboarding since the wallet supports many chains.

### Architecture

- **Global derived address list** — on import, derive addresses from index 0 up to a fixed ceiling (e.g. 20) and store them all. This is a pure key derivation step, no network calls. The list is shared across all chains.
- **Per-chain lazy detection** — when the user opens/switches to a chain for the first time, scan the global address list against that chain's RPC: check ETH balance and tx count for each address. Mark addresses with non-zero balance or activity as "active on this chain."
- **Cache results** — once a chain has been scanned, store the results so re-opening the chain doesn't re-scan. Invalidate/re-scan on manual refresh or after a configurable TTL.
- **Active address display** — on the home screen for a given chain, show all addresses that are active on that chain. Addresses with no activity on the current chain are hidden but still available via Settings → Accounts.

### Behavior

- On mnemonic import, derive N addresses (default ceiling = 20) and persist them — no RPC calls at this stage
- When the user switches to a network, if that network hasn't been scanned yet:
  - Batch-query balances and tx counts for all derived addresses against that chain's RPC
  - Show a subtle loading indicator during the scan
  - Mark addresses with balance > 0 or txCount > 0 as active for that chain
  - Cache the scan result per chain
- If no derived address beyond index 0 has activity on the current chain, behave as today (single account)
- User can increase the derivation ceiling or manually add more addresses from Settings → Accounts
- Re-scan can be triggered manually or happens automatically if cached results are older than TTL

### Chain list scan status indicator

In the network/chain selector list, each chain shows a small inline indicator reflecting its account discovery state:

- **Not scanned yet** — no indicator (default state for all chains after import)
- **Scanning** — subtle spinner or pulsing dot next to the chain name while RPC calls are in flight
- **Scanned, accounts found** — small badge showing the number of active addresses (e.g. "3 accounts") next to the chain name
- **Scanned, no extra accounts** — no badge (only the default index-0 address is active, same as current behavior)
- **Scan failed** — warning icon with retry option (RPC timeout, rate limit, etc.)

This lets the user see at a glance which chains have been checked and where they have funds, without needing to open each chain individually.

### Steps

[] - implement BIP-44 batch derivation (index 0…N, default N=20) on mnemonic import, persist global address list
[] - add per-chain lazy balance/activity scan triggered on network switch
[] - batch RPC calls (multicall or parallel `eth_getBalance` + `eth_getTransactionCount`) for all derived addresses
[] - cache per-chain scan results in storage with TTL-based invalidation
[] - add scan status indicator to chain selector list (spinner while scanning, account count badge when done, warning on failure)
[] - show subtle loading state on home screen during per-chain scan ("Checking accounts…")
[] - display active addresses for the current chain on the home screen, hide inactive ones
[] - add Settings → Accounts: show all derived addresses, per-chain activity status, option to increase derivation ceiling
[] - add manual re-scan / refresh action per chain