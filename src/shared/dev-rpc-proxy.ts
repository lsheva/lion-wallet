/**
 * Vite dev-only JSON-RPC proxy path. The segment after this prefix is a single
 * URI-encoded upstream RPC URL (`encodeURIComponent`), readable as percent-escapes
 * in devtools. Implemented in `scripts/vite-dev-rpc-proxy.ts`.
 */
export const DEV_RPC_PROXY_PREFIX = "/__dev_rpc/" as const;

/** Encode `rpcUrl` for use as one path segment (works in workers + window). */
export function encodeRpcUrlForDevProxy(rpcUrl: string): string {
  return encodeURIComponent(rpcUrl);
}

/** Inverse of `encodeRpcUrlForDevProxy`; used by the Vite dev proxy middleware. */
export function decodeRpcUrlFromDevProxy(segment: string): string {
  return decodeURIComponent(segment);
}
