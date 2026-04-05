/**
 * Vite dev-only JSON-RPC proxy path. The segment after this prefix is a base64url
 * encoding of the full upstream RPC URL (see `encodeRpcUrlForDevProxy`).
 * Implemented in `scripts/vite-dev-rpc-proxy.ts`.
 */
export const DEV_RPC_PROXY_PREFIX = "/__dev_rpc/" as const;

/** Encode `rpcUrl` for use as a single path segment (works in workers + window). */
export function encodeRpcUrlForDevProxy(rpcUrl: string): string {
  const bytes = new TextEncoder().encode(rpcUrl);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
