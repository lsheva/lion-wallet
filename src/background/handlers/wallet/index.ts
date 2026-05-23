/**
 * Wallet message handlers — aggregated entry point.
 *
 * `message-router.ts` and other consumers import from here:
 *
 * ```ts
 * import * as wallet from "./handlers/wallet";
 * wallet.handleCreateWallet(password);
 * ```
 *
 * Per-domain modules:
 * - [`./keyrings`](./keyrings.ts) — create/import wallet, add/rename/delete keyring, import private key
 * - [`./accounts`](./accounts.ts) — derive, switch, rename, remove HD/imported accounts
 * - [`./state`](./state.ts) — GET_STATE, network switch, chain discovery, reset, mnemonic/key export
 * - [`./balance`](./balance.ts) — native + ERC-20 balance, prices, token info
 * - [`./send`](./send.ts) — single ERC-20 send, multi-send (FeedFace disperse or per-tx fallback)
 * - [`./_shared`](./_shared.ts) — handler-layer helpers (vault merge/persist, requireMeta, etc.)
 */

export { retrieveHdMnemonicForKeyring } from "../../wallet-internal";
// Used by `handlers/approval.ts` for in-process key retrieval.
export { retrieveImportedKey } from "./_shared";
export {
  handleAddAccount,
  handleDeriveAccount,
  handleGetAccounts,
  handleRemoveAccount,
  handleRenameAccount,
  handleSwitchAccount,
} from "./accounts";

export {
  handleGetBalance,
  handleGetTokenBalances,
  handleGetTokenInfo,
  handleGetTokenPrice,
} from "./balance";
export {
  handleAddKeyringCreate,
  handleAddKeyringImport,
  handleCreateWallet,
  handleDeleteKeyring,
  handleImportPrivateKey,
  handleImportWallet,
  handleRenameKeyring,
} from "./keyrings";
export { handleMultiSend, handleSendToken } from "./send";
export {
  handleEnsureChainDiscovery,
  handleExportMnemonic,
  handleExportPrivateKey,
  handleGetState,
  handleResetWallet,
  handleSwitchNetwork,
} from "./state";
