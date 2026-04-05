---
name: Multi-keyring implementation
overview: Multiple HD keyrings plus a dedicated imported-private-key keyring with no mnemonic; vault migration, keychain, signing, discovery, and UI.
todos:
  - id: types-migration
    content: Add Keyring discriminated union (HD vs imported, no mnemonic on imported), VaultData v2, migration
    status: pending
  - id: keychain-multi
    content: Per-keyring mnemonic keys for HD only; imported keyring stores no mnemonic in keychain
    status: pending
  - id: handlers-imported-keyring
    content: Private-key import appends to imported keyring; eliminate dummy seed; merge keyrings on add/import
    status: pending
  - id: handlers-signing
    content: Signing and export resolve by keyringId + derivation index or importedKeys
    status: pending
  - id: hd-discovery
    content: Per-keyring hdDerivedAddresses; imported keyring skips HD scan
    status: pending
  - id: popup-ui
    content: Grouped AccountSwitcher; single Imported section for all PK imports
    status: pending
isProject: false
---



