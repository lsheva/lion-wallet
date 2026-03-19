import {
  createWalletClient,
  http,
  parseGwei,
  formatEther,
  formatGwei,
  type Hex,
  type Address,
} from "viem";
import type { GasPresets, GasSpeed, TransactionParams } from "../shared/types";
import { getPublicClient, getNetworkConfig } from "./networks";
import * as wallet from "./wallet";

function getAccount() {
  const mnemonic = wallet.getMnemonic();
  if (!mnemonic) throw new Error("Wallet is locked");
  const idx = wallet.getActiveAccountIndex();
  const accounts = wallet.getAccounts();
  const active = accounts[idx];
  if (active?.path === "imported") {
    const pk = wallet.getImportedKey(active.address);
    if (!pk) throw new Error("Imported private key not found");
    return wallet.getSignerFromKey(pk);
  }
  return wallet.getSigner(mnemonic, idx);
}

function getWalletClient(chainId: number) {
  const network = getNetworkConfig(chainId);
  if (!network) throw new Error(`Unknown chain: ${chainId}`);

  const viemChainImport = getPublicClient(chainId).chain;
  return createWalletClient({
    account: getAccount(),
    chain: viemChainImport,
    transport: http(network.rpcUrl),
  });
}

export async function estimateGasPresets(
  chainId: number,
  tx: TransactionParams,
): Promise<GasPresets> {
  const client = getPublicClient(chainId);

  const [gasLimit, block, priorityFee] = await Promise.all([
    client.estimateGas({
      account: tx.from ?? wallet.getAccounts()[wallet.getActiveAccountIndex()]?.address,
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
  chainId: number,
  params: TransactionParams,
  gasSpeed: GasSpeed = "normal",
): Promise<Hex> {
  const client = getWalletClient(chainId);
  const presets = await estimateGasPresets(chainId, params);
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
  chainId: number,
  params: TransactionParams,
  gasSpeed: GasSpeed = "normal",
): Promise<Hex> {
  const account = getAccount();
  const publicClient = getPublicClient(chainId);
  const presets = await estimateGasPresets(chainId, params);
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

export async function personalSign(message: string | Hex): Promise<Hex> {
  const account = getAccount();
  if (message.startsWith("0x")) {
    return account.signMessage({ message: { raw: message as Hex } });
  }
  return account.signMessage({ message });
}

export async function ethSign(hash: Hex): Promise<Hex> {
  const account = getAccount();
  return account.signMessage({ message: { raw: hash } });
}

export async function signTypedDataV4(params: [Address, string]): Promise<Hex> {
  const account = getAccount();
  const typedData = JSON.parse(params[1]);
  const { domain, types, primaryType, message } = typedData;

  const filteredTypes = { ...types };
  delete filteredTypes.EIP712Domain;

  return account.signTypedData({
    domain,
    types: filteredTypes,
    primaryType,
    message,
  });
}
