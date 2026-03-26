/**
 * Format a token balance for display.
 *
 * - Up to 4 meaningful (non-leading-zero) digits after the decimal point
 * - K / M / G / T suffixes for values >= 1 000
 * - Strips trailing zeros
 * - Very small values (between 0 and 1, 5+ leading zeros after decimal): `0.0` + subscript count + significant digits (see `getTokenValueDisplay` + `FormattedTokenValue`)
 */

import { formatRevertFingerprintForDisplay } from "./revert-decode";
import type { AddressBookEntry, SerializedAccount } from "./types";

/** Segment for HTML/Preact rendering (`<sub>` for repeated zero count). */
export type TokenValuePiece = { kind: "text"; text: string } | { kind: "sub"; text: string };

export interface TokenValueDisplay {
  pieces: TokenValuePiece[];
}

export function getTokenValueDisplay(value: string | number): TokenValueDisplay {
  if (typeof value === "string" && !/\d/.test(value)) {
    return { pieces: [{ kind: "text", text: value || "0" }] };
  }
  const num = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;

  if (Number.isNaN(num) || num === 0) {
    return { pieces: [{ kind: "text", text: "0" }] };
  }

  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (abs >= 1e12) return displayScaled(sign, abs / 1e12, "T");
  if (abs >= 1e9) return displayScaled(sign, abs / 1e9, "G");
  if (abs >= 1e6) return displayScaled(sign, abs / 1e6, "M");
  if (abs >= 1e3) return displayScaled(sign, abs / 1e3, "K");

  return displayScaled(sign, abs, "");
}

function displayScaled(sign: string, n: number, suffix: string): TokenValueDisplay {
  const tail = suffix;
  const inner = decimalPieces(n);
  if (inner.length === 1 && inner[0]?.kind === "text") {
    return { pieces: [{ kind: "text", text: sign + inner[0]?.text + tail }] };
  }
  const pieces: TokenValuePiece[] = [];
  if (sign) pieces.push({ kind: "text", text: sign });
  pieces.push(...inner);
  if (tail) pieces.push({ kind: "text", text: tail });
  return { pieces };
}

function decimalPieces(n: number): TokenValuePiece[] {
  if (n >= 1) {
    return [{ kind: "text", text: trimTrailing(n.toFixed(4)) }];
  }

  const full = n.toFixed(20);
  const dotIdx = full.indexOf(".");
  let firstSig = -1;
  for (let i = dotIdx + 1; i < full.length; i++) {
    if (full[i] !== "0") {
      firstSig = i;
      break;
    }
  }
  if (firstSig < 0) return [{ kind: "text", text: "0" }];

  const leadingZeros = firstSig - dotIdx - 1;

  if (leadingZeros >= 5) {
    const sigDigits = full.slice(firstSig, firstSig + 4).replace(/0+$/, "");
    return [
      { kind: "text", text: "0.0" },
      { kind: "sub", text: String(leadingZeros) },
      { kind: "text", text: sigDigits },
    ];
  }

  return [{ kind: "text", text: trimTrailing(n.toFixed(leadingZeros + 4)) }];
}

function trimTrailing(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

/** Quick regex check for a 0x-prefixed 40-hex-char Ethereum address. */
export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/** Truncate an Ethereum address to `0x1234…abcd` form. */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address || "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Trim to at most `maxChars` characters; if longer, end with an ellipsis (counts toward the limit). */
export function truncateWithEllipsis(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars - 1) + "…";
}

/**
 * Deterministic HSL for `TokenImage` letter fallback (activity + token list).
 * Color is **generated** from the address hash but constrained to the Lion warm theme:
 * hue in the amber→orange→mane-brown band (see `brand/LION_PALETTE.md`), saturation and
 * lightness bounded so fills stay “savanna” and stay dark enough for white letter glyphs.
 */
export function tokenColorFromAddress(address: string): string {
  let a = 0;
  let b = 0;
  for (let i = 0; i < address.length; i++) {
    const c = address.charCodeAt(i);
    a = (a * 31 + c) >>> 0;
    b = (b * 33 + c * (i + 1)) >>> 0;
  }
  const hue = 12 + (a % 37); // ~12–48° (warm only; no greens/blues/purples)
  const sat = 34 + (b % 48); // 34–81%
  const light = 28 + ((a ^ b) % 20); // 28–47% — readable white text on circle
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/**
 * Human-readable label for an address if it matches a wallet account or address book entry (account wins).
 */
export function resolveAddressAlias(
  address: string,
  accounts: SerializedAccount[],
  addressBook: AddressBookEntry[],
): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  const acc = accounts.find((a) => a.address.toLowerCase() === lower);
  if (acc) return acc.name;
  const entry = addressBook.find((e) => e.address.toLowerCase() === lower);
  return entry?.name ?? null;
}

/** Safely extract a human-readable message from an unknown catch value. */
export function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function baseGasEstimateMessage(e: unknown): string {
  if (e instanceof Error && e.message.trim()) {
    return e.message.trim();
  }
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.shortMessage === "string" && o.shortMessage.trim()) {
      return o.shortMessage.trim();
    }
    if (typeof o.details === "string" && o.details.trim()) {
      return o.details.trim();
    }
    if (o.cause) {
      return baseGasEstimateMessage(o.cause);
    }
  }
  return toErrorMessage(e);
}

/**
 * Best-effort message for failed `eth_estimateGas` / viem `estimateGas`.
 * When the error chain includes {@link ContractFunctionRevertedError} (e.g. after `simulateContract`), appends `reason` / `signature` / decoded data.
 */
export function formatGasEstimateError(e: unknown): string {
  const base = baseGasEstimateMessage(e);
  const revert = formatRevertFingerprintForDisplay(e);
  if (revert) {
    return `${base}\n\n— Revert —\n${revert}`;
  }
  return base;
}

/** Fiat string for UI (always two decimal places). */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
