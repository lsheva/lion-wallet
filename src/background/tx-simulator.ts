import { type Address, decodeFunctionData, formatUnits } from "viem";
import type { TokenTransfer, TransactionParams } from "../shared/types";
import { getPublicClient } from "./networks";
import { fetchTokenMeta } from "./token-meta";

function deterministicColor(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash + address.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

async function simulateViaTrace(
  txParams: TransactionParams,
  chainId: number,
  account: Address,
  log: string[],
): Promise<TokenTransfer[] | null> {
  const client = getPublicClient(chainId);

  try {
    log.push("sim: calling eth_simulateV1");
    const result = await (
      client as unknown as {
        request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
      }
    ).request({
      method: "eth_simulateV1",
      params: [
        {
          blockStateCalls: [
            {
              stateOverrides: {},
              calls: [
                {
                  from: account,
                  to: txParams.to,
                  value: txParams.value ?? "0x0",
                  data: txParams.data ?? "0x",
                },
              ],
            },
          ],
          traceTransfers: true,
        },
        "latest",
      ],
    });

    const simBlocks = result as Array<{
      calls?: Array<{
        status?: string;
        logs?: Array<{
          address: string;
          topics: string[];
          data: string;
        }>;
      }>;
    }>;

    if (!simBlocks?.[0]?.calls?.[0]) {
      log.push("sim: eth_simulateV1 returned no calls");
      return null;
    }

    const transfers: TokenTransfer[] = [];
    const callResult = simBlocks[0].calls[0];
    log.push(
      `sim: eth_simulateV1 OK, status=${callResult.status}, logs=${callResult.logs?.length ?? 0}`,
    );

    if (callResult.logs) {
      const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

      for (const logEntry of callResult.logs) {
        if (logEntry.topics[0] !== transferTopic || logEntry.topics.length < 3) continue;

        const from = `0x${logEntry.topics[1]!.slice(26)}`.toLowerCase();
        const to = `0x${logEntry.topics[2]!.slice(26)}`.toLowerCase();
        const accountLower = account.toLowerCase();

        if (from !== accountLower && to !== accountLower) continue;

        const amount = BigInt(logEntry.data || "0x0");
        const tokenAddr = logEntry.address.toLowerCase();

        const meta = await fetchTokenMeta(chainId, tokenAddr);

        transfers.push({
          direction: from === accountLower ? "out" : "in",
          symbol: meta.symbol,
          name: meta.name,
          amount: formatUnits(amount < 0n ? -amount : amount, meta.decimals),
          color: deterministicColor(tokenAddr),
          tokenAddress: tokenAddr,
        });
      }
    }

    if (txParams.value && txParams.value !== "0x0" && txParams.value !== "0x") {
      const val = BigInt(txParams.value);
      if (val > 0n) {
        transfers.unshift({
          direction: "out",
          symbol: "ETH",
          name: "Ethereum",
          amount: formatUnits(val, 18),
          color: "#627EEA",
        });
      }
    }

    return transfers.length > 0 ? transfers : null;
  } catch (e) {
    log.push(`sim: eth_simulateV1 failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

// Token metadata is resolved via the shared token-meta module (fetchTokenMeta)

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

async function fallbackErc20Parse(
  txParams: TransactionParams,
  chainId: number,
  account: Address,
  log: string[],
): Promise<TokenTransfer[]> {
  const transfers: TokenTransfer[] = [];

  if (txParams.value && txParams.value !== "0x0" && txParams.value !== "0x") {
    const val = BigInt(txParams.value);
    if (val > 0n) {
      log.push(`sim-fallback: native value=${formatUnits(val, 18)}`);
      transfers.push({
        direction: "out",
        symbol: "ETH",
        name: "Ethereum",
        amount: formatUnits(val, 18),
        color: "#627EEA",
      });
    }
  } else {
    log.push(`sim-fallback: no native value (value=${txParams.value ?? "undefined"})`);
  }

  if (txParams.data && txParams.data.length >= 10) {
    try {
      const { functionName, args } = decodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        data: txParams.data,
      });

      log.push(`sim-fallback: matched ERC-20 ${functionName}`);
      const meta = await fetchTokenMeta(chainId, txParams.to!);

      if (functionName === "transfer") {
        const [, amount] = args as [Address, bigint];
        transfers.push({
          direction: "out",
          symbol: meta.symbol,
          name: meta.name,
          amount: formatUnits(amount, meta.decimals),
          color: deterministicColor(txParams.to.toLowerCase()),
          tokenAddress: txParams.to.toLowerCase(),
        });
      } else if (functionName === "transferFrom") {
        const [from, , amount] = args as [Address, Address, bigint];
        const isOut = from.toLowerCase() === account.toLowerCase();
        transfers.push({
          direction: isOut ? "out" : "in",
          symbol: meta.symbol,
          name: meta.name,
          amount: formatUnits(amount, meta.decimals),
          color: deterministicColor(txParams.to.toLowerCase()),
          tokenAddress: txParams.to.toLowerCase(),
        });
      }
    } catch {
      log.push(`sim-fallback: not a known ERC-20 call (selector=${txParams.data.slice(0, 10)})`);
    }
  }

  return transfers;
}

export type SimulationSource = "trace" | "fallback";

export interface SimulationResult {
  transfers: TokenTransfer[];
  via: SimulationSource;
}

export async function simulateTx(
  txParams: TransactionParams,
  chainId: number,
  account: Address,
  log: string[] = [],
): Promise<SimulationResult> {
  const traceResult = await simulateViaTrace(txParams, chainId, account, log);
  if (traceResult) return { transfers: traceResult, via: "trace" };

  log.push("sim: trace failed, trying ERC-20 fallback");
  const fallback = await fallbackErc20Parse(txParams, chainId, account, log);
  return { transfers: fallback, via: "fallback" };
}
