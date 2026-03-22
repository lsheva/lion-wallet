import type { Address } from "viem";
import type { MessageResponse } from "../../shared/messages";
import { fetchTokenMeta } from "../token-meta";
import { addManualToken, getTokensForChain, hideToken } from "../token-store";

export async function handleGetDiscoveredTokens(
  chainId: number,
  walletAddress: Address,
): Promise<MessageResponse> {
  const tokens = await getTokensForChain(chainId, walletAddress);
  return { ok: true, data: { tokens } };
}

export async function handleHideDiscoveredToken(
  chainId: number,
  walletAddress: Address,
  tokenAddress: Address,
): Promise<MessageResponse> {
  await hideToken(chainId, walletAddress, tokenAddress);
  return { ok: true };
}

export async function handleAddManualToken(
  tokenAddress: Address,
  chainId: number,
  walletAddress: Address,
): Promise<MessageResponse> {
  const meta = await fetchTokenMeta(chainId, tokenAddress);
  if (meta.symbol === "???") {
    return { ok: false, error: "Could not read token contract" };
  }
  await addManualToken(chainId, walletAddress, tokenAddress, meta);
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
