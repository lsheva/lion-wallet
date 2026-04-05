import { normalizeMnemonicForCompare } from "./vault-migrate";

export async function mnemonicFingerprint(mnemonic: string): Promise<string> {
  const n = normalizeMnemonicForCompare(mnemonic);
  const buf = new TextEncoder().encode(n);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
