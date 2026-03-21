# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Lion Wallet, **do not open a public issue.**

Instead, please report it privately:

- Email: *(add your security contact email here)*
- Or use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) if available on this repo

Include as much detail as possible:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive an acknowledgment within 48 hours and a more detailed response within 7 days.

## Scope

The following are in scope:

- Key management (mnemonic generation, derivation, storage, export)
- Vault encryption (PBKDF2 + AES-GCM)
- macOS Keychain integration
- Transaction signing and approval flow
- EIP-1193 provider and content script injection
- Message passing between content script, background, and popup

The following are out of scope:

- Vulnerabilities in upstream dependencies (report to the respective project)
- Phishing or social engineering attacks
- Issues requiring physical access to an unlocked machine

## Security Architecture

- **Keychain mode (macOS):** Keys stored in macOS Keychain with `.userPresence` access control (Touch ID / system password per retrieval). No additional encryption layer.
- **Vault mode (fallback):** PBKDF2 with 600,000 iterations + AES-GCM via Web Crypto API. Keys encrypted at rest in `browser.storage.local`.
- **No persistent key memory:** Private keys and mnemonics are never held in memory beyond a single operation scope.
- **No remote telemetry:** The extension makes no network requests except user-initiated RPC calls and optional price/explorer API lookups.

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x (current) | Yes |
