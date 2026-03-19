import browser from "webextension-polyfill";
import type { EncryptedVault, VaultData } from "../shared/types";

const STORAGE_KEY = "vault";
const PBKDF2_ITERATIONS = 600_000;

let cachedPassword: string | null = null;

export function getCachedPassword(): string | null {
  return cachedPassword;
}

export function clearCachedPassword(): void {
  cachedPassword = null;
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(
  password: string,
  salt: ArrayBuffer,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVault(
  data: VaultData,
  password: string,
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt.buffer);

  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  const vault: EncryptedVault = {
    salt: toBase64(salt.buffer),
    iv: toBase64(iv.buffer),
    ciphertext: toBase64(ciphertext),
  };

  await browser.storage.local.set({ [STORAGE_KEY]: vault });
  cachedPassword = password;
}

export async function decryptVault(password: string): Promise<VaultData> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const vault = result[STORAGE_KEY] as EncryptedVault | undefined;
  if (!vault) throw new Error("No vault found");

  const salt = fromBase64(vault.salt);
  const iv = fromBase64(vault.iv);
  const ciphertext = fromBase64(vault.ciphertext);

  const key = await deriveKey(password, salt);

  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("Wrong password");
  }

  cachedPassword = password;
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export async function isVaultInitialized(): Promise<boolean> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] != null;
}

export async function clearVault(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}
