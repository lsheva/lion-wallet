import type { Address } from "viem";
import type { MessageResponse } from "../../shared/messages";
import { fetchTokenMeta } from "../token-meta";
import { addManualToken, getTokensForChain, hideToken } from "../token-store";

export async function handleGetDiscoveredTokens(chainId: number): Promise<MessageResponse> {
  const tokens = await getTokensForChain(chainId);
  return { ok: true, data: { tokens } };
}

export async function handleHideDiscoveredToken(
  chainId: number,
  address: Address,
): Promise<MessageResponse> {
  await hideToken(chainId, address);
  return { ok: true };
}

export async function handleAddManualToken(
  address: Address,
  chainId: number,
): Promise<MessageResponse> {
  const meta = await fetchTokenMeta(chainId, address);
  if (meta.symbol === "???") {
    return { ok: false, error: "Could not read token contract" };
  }
  await addManualToken(chainId, address, meta);
  return { ok: true };
}

export async function handleScanTokens(
  chainId: number,
  address: Address,
): Promise<MessageResponse> {
  const { scanTokens } = await import("../token-discovery");
  const found = await scanTokens(address, chainId);
  return { ok: true, data: { found } };
}
