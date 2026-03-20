import {
  type Address,
  createWalletClient,
  formatEther,
  formatGwei,
  type Hex,
  http,
  parseGwei,
} from "viem";
import type { GasPresets, GasSpeed, SerializedAccount, TransactionParams } from "../shared/types";
import { getPublicClient, getRpcUrl } from "./networks";
import * as wallet from "./wallet";

type Account = ReturnType<typeof wallet.getSigner> | ReturnType<typeof wallet.getSignerFromKey>;

export function getAccountForSigning(
  mnemonic: string,
  accountIndex: number,
  accounts: SerializedAccount[],
  importedKey?: Hex,
): Account {
  const active = accounts[accountIndex];
  if (active?.path === "imported" && importedKey) {
    return wallet.getSignerFromKey(importedKey);
  }
  return wallet.getSigner(mnemonic, accountIndex);
}

function getWalletClient(account: Account, chainId: number) {
  const chain = getPublicClient(chainId).chain;
  return createWalletClient({
    account,
    chain,
    transport: http(getRpcUrl(chainId)),
  });
}

export async function estimateGasPresets(
  chainId: number,
  tx: TransactionParams,
  fromAddress?: Address,
): Promise<GasPresets> {
  const client = getPublicClient(chainId);

  const [gasLimit, block, priorityFee] = await Promise.all([
    client.estimateGas({
      account: tx.from ?? fromAddress,
      to: tx.to,
      value: tx.value ? BigInt(tx.value) : undefined,
      data: tx.data,
    }),
    client.getBlock({ blockTag: "latest" }),
    client.request({ method: "eth_maxPriorityFeePerGas" } as never).catch(() => "0x59682F00"),
  ]);

  const baseFee = block.baseFeePerGas ?? parseGwei("20");
  const basePriority = BigInt(priorityFee as string);
  const gasLimitWithBuffer = (gasLimit * 120n) / 100n;

  const multipliers: Record<GasSpeed, { baseMul: bigint; priorityMul: bigint }> = {
    slow: { baseMul: 100n, priorityMul: 80n },
    normal: { baseMul: 120n, priorityMul: 100n },
    fast: { baseMul: 150n, priorityMul: 150n },
  };

  function buildEstimate(speed: GasSpeed) {
    const { baseMul, priorityMul } = multipliers[speed];
    const maxPriority = (basePriority * priorityMul) / 100n;
    const maxFee = (baseFee * baseMul) / 100n + maxPriority;
    const cost = gasLimitWithBuffer * maxFee;
    return {
      gasLimit: gasLimitWithBuffer.toString(),
      maxFeePerGas: maxFee.toString(),
      maxPriorityFeePerGas: maxPriority.toString(),
      estimatedCostWei: cost.toString(),
      estimatedCostEth: formatEther(cost),
    };
  }

  return {
    slow: buildEstimate("slow"),
    normal: buildEstimate("normal"),
    fast: buildEstimate("fast"),
    baseFeeGwei: formatGwei(baseFee),
  };
}

export async function sendTransaction(
  account: Account,
  chainId: number,
  params: TransactionParams,
  gasSpeed: GasSpeed = "normal",
): Promise<Hex> {
  const client = getWalletClient(account, chainId);
  const presets = await estimateGasPresets(chainId, params, account.address);
  const gas = presets[gasSpeed];

  return client.sendTransaction({
    to: params.to,
    value: params.value ? BigInt(params.value) : undefined,
    data: params.data,
    gas: BigInt(gas.gasLimit),
    maxFeePerGas: BigInt(gas.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(gas.maxPriorityFeePerGas),
    nonce: params.nonce ? Number(params.nonce) : undefined,
    chain: null,
  });
}

export async function signTransaction(
  account: Account,
  chainId: number,
  params: TransactionParams,
  gasSpeed: GasSpeed = "normal",
): Promise<Hex> {
  const publicClient = getPublicClient(chainId);
  const presets = await estimateGasPresets(chainId, params, account.address);
  const gas = presets[gasSpeed];

  const nonce = params.nonce
    ? Number(params.nonce)
    : await publicClient.getTransactionCount({ address: account.address });

  return account.signTransaction({
    to: params.to,
    value: params.value ? BigInt(params.value) : undefined,
    data: params.data,
    gas: BigInt(gas.gasLimit),
    maxFeePerGas: BigInt(gas.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(gas.maxPriorityFeePerGas),
    nonce,
    chainId: chainId,
    type: "eip1559" as const,
  });
}

export async function personalSign(account: Account, message: string | Hex): Promise<Hex> {
  if (message.startsWith("0x")) {
    return account.signMessage({ message: { raw: message as Hex } });
  }
  return account.signMessage({ message });
}

export async function ethSign(account: Account, hash: Hex): Promise<Hex> {
  return account.signMessage({ message: { raw: hash } });
}

export async function signTypedDataV4(account: Account, params: [Address, string]): Promise<Hex> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(params[1]);
  } catch {
    throw new Error("Invalid typed data: malformed JSON");
  }

  const { domain, types, primaryType, message } = parsed as {
    domain: Parameters<Account["signTypedData"]>[0]["domain"];
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  };

  const filteredTypes = { ...types };
  delete filteredTypes.EIP712Domain;

  return account.signTypedData({
    domain,
    types: filteredTypes,
    primaryType,
    message,
  });
}
