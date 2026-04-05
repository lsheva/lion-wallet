/** Stable id for the synthetic keyring that groups standalone private-key imports (no mnemonic). */
export const IMPORTED_KEYRING_ID = "imported" as const;

/** Legacy single-seed migration target. */
export const DEFAULT_KEYRING_ID = "default" as const;

export function keychainKeyringKey(keyringId: string): string {
  return `keyring-${keyringId}`;
}
