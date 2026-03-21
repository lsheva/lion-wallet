# Changelog

All notable changes to Lion Wallet are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Transaction activity feed on home page
- Etherscan API integration for transaction history
- Transaction decoding metadata (`via` field — etherscan, 4byte, selector)
- Transfer simulation metadata (`via` field — trace, fallback)
- Approval page hints when API keys are missing

### Changed
- Improved approval page transaction content display

## [0.1.0] — 2026-03-21

First functional release. Safari-native EVM wallet with full send/sign/approve flow.

### Added
- **Wallet core:** BIP-39 mnemonic generation, BIP-44 HD derivation, private key import
- **Vault encryption:** PBKDF2 (600k iterations) + AES-GCM via Web Crypto API
- **macOS Keychain integration:** keys stored in system Keychain with Touch ID per retrieval; password-based vault as cross-platform fallback
- **86 EVM chains:** 49 mainnets, 36 testnets, Hardhat — all from viem/chains
- **EIP-1193 provider:** `window.ethereum` with MetaMask compat, EIP-6963 announcement
- **Transaction signing:** eth_sendTransaction, eth_signTransaction, personal_sign, eth_sign, eth_signTypedData_v4
- **Gas presets:** slow/normal/fast derived from base fee + priority fee
- **Send from popup:** ETH and ERC-20 transfers with token selector, balance display, MAX button
- **Transaction tracking:** live confirmation count, revert detection, block explorer links
- **Alchemy RPC support:** optional API key routes 26 chains through Alchemy, public RPC fallback
- **Etherscan integration:** optional API key for ABI decoding in transaction approvals
- **Network selector:** grouped mainnets/testnets with brand colors and visual testnet distinction
- **Account management:** multiple HD accounts, account switching, private key export, recovery phrase export
- **Full popup UI:** Preact + Tailwind, 20+ pages/components, mock layer for dev
- **Safari popup fix:** `route(path, true)` replace navigation to keep history depth at 1

### Changed
- Eliminated lock/unlock model — wallet always ready, auth per-operation
- NetworkConfig embeds viem `Chain` directly instead of duplicating fields
- Token display uses `formatTokenValue` with K/M/G/T suffixes
- Type checking via tsgo (~4x faster than tsc)

### Branding
- Product renamed to Lion Wallet
- EIP-6963 identity: `dev.wallet.lion`
- Lion paw toolbar icon, full lion app icon
