/**
 * Format a token balance for display.
 *
 * - Up to 4 meaningful (non-leading-zero) digits after the decimal point
 * - K / M / G / T suffixes for values >= 1 000
 * - Strips trailing zeros
 * - Very small values (between 0 and 1, 5+ leading zeros after decimal): `0.0` + subscript count + significant digits (see `getTokenValueDisplay` + `FormattedTokenValue`)
 */

/** Segment for HTML/Preact rendering (`<sub>` for repeated zero count). */
export type TokenValuePiece = { kind: "text"; text: string } | { kind: "sub"; text: string };

export interface TokenValueDisplay {
  pieces: TokenValuePiece[];
}

export function getTokenValueDisplay(value: string | number): TokenValueDisplay {
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
  const tail = suffix ? suffix : "";
  const inner = decimalPieces(n);
  if (inner.length === 1 && inner[0]!.kind === "text") {
    return { pieces: [{ kind: "text", text: sign + inner[0]!.text + tail }] };
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

/** Plain string (no HTML). Compact small values: `0.0(n)sig` with parentheses around the zero count. */
export function formatTokenValue(value: string | number): string {
  const { pieces } = getTokenValueDisplay(value);
  let out = "";
  for (const p of pieces) {
    if (p.kind === "text") out += p.text;
    else out += `(${p.text})`;
  }
  return out;
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
