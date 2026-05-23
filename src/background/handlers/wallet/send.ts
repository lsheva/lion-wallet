/**
 * Send (single ERC-20 transfer) and multi-send.
 *
 * Multi-send takes a flat list of `MultiSendEntry` and either:
 * - When the chain has a `disperseAddress`: builds one `disperse(...)` call
 *   to the FeedFaceDisperse contract (single batched tx + per-token approvals
 *   if needed), so all recipients receive funds in one signed transaction.
 * - Otherwise: queues one approval per recipient/token pair through the normal
 *   approval flow.
 */
import type { Address } from "viem";
import { readContract } from "viem/actions";
import { encodeFunctionData, formatUnits, numberToHex, parseUnits } from "viem/utils";
import { erc20Abi, feedFaceDisperseAbi } from "../../../shared/abis";
import type { MessageResponse } from "../../../shared/messages";
import type { DecodedCall, MultiSendEntry, TokenTransfer } from "../../../shared/types";
import { getActiveAccount } from "../../account-utils";
import { getActiveNetworkId, getNetworkConfig, getPublicClient } from "../../networks";
import { handleRpc } from "../../rpc-handler";
import { loadAccountsMeta } from "../../vault";

function buildTransfers(entries: MultiSendEntry[]): TokenTransfer[] {
  return entries.map((e) => ({
    direction: "out" as const,
    symbol: e.symbol,
    name: e.tokenName,
    amount: e.amount,
    color: "#627EEA",
    tokenAddress: e.tokenAddress,
  }));
}

export async function handleSendToken(
  tokenAddress: Address,
  to: Address,
  amount: string,
  decimals: number,
): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  const account = meta ? getActiveAccount(meta) : undefined;
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, parseUnits(amount, decimals)],
  });

  const result = await handleRpc(
    "eth_sendTransaction",
    [{ from: account.address, to: tokenAddress, data }],
    { origin: "lion-wallet://popup" },
  );
  return { ok: true, data: result };
}

export async function handleMultiSend(entries: MultiSendEntry[]): Promise<MessageResponse> {
  if (entries.length === 0) return { ok: false, error: "No entries provided" };

  const meta = await loadAccountsMeta();
  const account = meta ? getActiveAccount(meta) : undefined;
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const chainId = await getActiveNetworkId();
  const network = getNetworkConfig(chainId);

  const nativeEntries = entries.filter((e) => !e.tokenAddress);
  const erc20ByToken = new Map<Address, MultiSendEntry[]>();
  for (const e of entries) {
    if (!e.tokenAddress) continue;
    const key = e.tokenAddress.toLowerCase() as Address;
    const group = erc20ByToken.get(key) ?? [];
    group.push(e);
    erc20ByToken.set(key, group);
  }

  const disperseAddr = network?.disperseAddress as Address | undefined;
  let queued = 0;

  if (!disperseAddr) {
    // Fallback path: one signed tx per recipient/token pair.
    for (const e of nativeEntries) {
      await handleRpc(
        "eth_sendTransaction",
        [
          {
            from: account.address,
            to: e.to,
            value: numberToHex(parseUnits(e.amount, e.decimals)),
          },
        ],
        { origin: "lion-wallet://popup" },
      );
      queued++;
    }
    for (const [tokenAddr, group] of erc20ByToken) {
      for (const e of group) {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [e.to, parseUnits(e.amount, e.decimals)],
        });
        const decoded: DecodedCall = {
          functionName: "transfer",
          args: [
            {
              name: "to",
              type: "address",
              value: `${e.to.slice(0, 6)}…${e.to.slice(-4)}`,
            },
            { name: "amount", type: "uint256", value: `${e.amount} ${e.symbol}` },
          ],
        };
        await handleRpc("eth_sendTransaction", [{ from: account.address, to: tokenAddr, data }], {
          origin: "lion-wallet://popup",
          extras: { prefilled: { decoded, transfers: buildTransfers([e]) } },
        });
        queued++;
      }
    }
    return { ok: true, data: { queued } };
  }

  // Disperse path: single batched call. Approve per token if allowance is short.
  const client = getPublicClient(chainId);

  const ethTransfers = nativeEntries.map((e) => ({
    to: e.to,
    amount: parseUnits(e.amount, e.decimals),
  }));
  const totalEthValue = ethTransfers.reduce((sum, t) => sum + t.amount, 0n);

  const tokenTransfers: { token: Address; to: Address; amount: bigint }[] = [];
  for (const e of entries) {
    if (!e.tokenAddress) continue;
    tokenTransfers.push({
      token: e.tokenAddress,
      to: e.to,
      amount: parseUnits(e.amount, e.decimals),
    });
  }

  for (const [tokenAddr, group] of erc20ByToken) {
    const first = group[0];
    if (!first) continue;
    const totalNeeded = group.reduce((sum, e) => sum + parseUnits(e.amount, e.decimals), 0n);

    let currentAllowance = 0n;
    try {
      currentAllowance = (await readContract(client, {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account.address, disperseAddr],
      })) as bigint;
    } catch {
      /* assume 0 */
    }

    if (currentAllowance < totalNeeded) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [disperseAddr, totalNeeded],
      });
      const approveDecoded: DecodedCall = {
        functionName: "approve",
        args: [
          { name: "spender", type: "address", value: "FeedFace Disperse" },
          {
            name: "amount",
            type: "uint256",
            value: `${formatUnits(totalNeeded, first.decimals)} ${first.symbol}`,
          },
        ],
      };
      await handleRpc(
        "eth_sendTransaction",
        [{ from: account.address, to: tokenAddr, data: approveData }],
        { origin: "lion-wallet://popup", extras: { prefilled: { decoded: approveDecoded } } },
      );
      queued++;
    }
  }

  const data = encodeFunctionData({
    abi: feedFaceDisperseAbi,
    functionName: "disperse",
    args: [ethTransfers, tokenTransfers, []],
  });
  const decoded: DecodedCall = {
    contractName: "FeedFaceDisperse",
    functionName: "disperse",
    args: [
      {
        name: "ethTransfers",
        type: "tuple[]",
        value: `${ethTransfers.length} recipient${ethTransfers.length === 1 ? "" : "s"}`,
      },
      {
        name: "tokenTransfers",
        type: "tuple[]",
        value: `${tokenTransfers.length} transfer${tokenTransfers.length === 1 ? "" : "s"}`,
      },
      { name: "permits", type: "tuple[]", value: "none" },
    ],
  };

  await handleRpc(
    "eth_sendTransaction",
    [
      {
        from: account.address,
        to: disperseAddr,
        ...(totalEthValue > 0n ? { value: numberToHex(totalEthValue) } : {}),
        data,
      },
    ],
    {
      origin: "lion-wallet://popup",
      extras: { prefilled: { decoded, transfers: buildTransfers(entries) } },
    },
  );
  queued++;

  return { ok: true, data: { queued } };
}
