import { toErrorMessage } from "@shared/format";
import { type Address, formatEther, type Hex } from "viem";
import type { MessageResponse } from "../../shared/messages";
import type { GasSpeed, TransactionParams } from "../../shared/types";
import {
  getPendingApproval,
  getPendingCount,
  rejectPendingApproval,
  resolvePendingApproval,
} from "../approval";
import { broadcastPendingCount, updateBadge } from "../broadcast";
import { getEtherscanApiKey } from "../etherscan";
import { bgLog } from "../log";
import { getNetworkConfig, hasRpcProviderKey } from "../networks";
import { fetchPrices } from "../prices";
import { handleRpc } from "../rpc-handler";
import {
  estimateGasPresets,
  ethSign,
  getAccountForSigning,
  personalSign,
  sendTransaction,
  signTransaction,
  signTypedDataV4,
} from "../signing";
import { decodeTx } from "../tx-decoder";
import { simulateTx } from "../tx-simulator";
import { getStorageMode, loadAccountsMeta } from "../vault";
import { retrieveImportedKey, retrieveMnemonic } from "./wallet";

function buildSigningReason(method: string, params: unknown[], chainId: number): string {
  const net = getNetworkConfig(chainId);
  const networkName = net?.chain.name ?? `Chain ${chainId}`;

  switch (method) {
    case "eth_sendTransaction":
    case "eth_signTransaction": {
      const tx = params[0] as TransactionParams | undefined;
      if (tx?.value && BigInt(tx.value) > 0n) {
        const symbol = net?.chain.nativeCurrency?.symbol ?? "ETH";
        const amount = formatEther(BigInt(tx.value));
        const to = tx.to ? `${tx.to.slice(0, 6)}…${tx.to.slice(-4)}` : "contract";
        return `Send ${amount} ${symbol} to ${to} on ${networkName}`;
      }
      const to = tx?.to ? `${tx.to.slice(0, 6)}…${tx.to.slice(-4)}` : "new contract";
      return `Sign transaction to ${to} on ${networkName}`;
    }
    case "personal_sign":
      return `Sign message on ${networkName}`;
    case "eth_sign":
      return `Sign data on ${networkName}`;
    case "eth_signTypedData_v4":
      return `Sign typed data on ${networkName}`;
    default:
      return `Authorize ${method} on ${networkName}`;
  }
}

async function executeApproval(
  id: string,
  gasSpeed: GasSpeed = "normal",
  password?: string,
): Promise<MessageResponse> {
  const pending = getPendingApproval();
  if (!pending || pending.id !== id) {
    return { ok: false, error: "No matching pending approval" };
  }

  try {
    const mode = await getStorageMode();
    const meta = await loadAccountsMeta();
    if (!meta) return { ok: false, error: "No accounts found" };

    const { method, params, chainId } = pending;
    const signingReason = buildSigningReason(method, params, chainId);

    const mnemonic = await retrieveMnemonic(mode, password, signingReason);
    const active = meta.accounts[meta.activeAccountIndex];
    let importedKey: Hex | undefined;
    if (active?.path === "imported") {
      importedKey =
        (await retrieveImportedKey(mode, active.address, password, signingReason)) ?? undefined;
    }

    const account = getAccountForSigning(
      mnemonic,
      meta.activeAccountIndex,
      meta.accounts,
      importedKey,
    );

    let result: string;

    switch (method) {
      case "eth_sendTransaction": {
        const txParams = params[0] as TransactionParams;
        result = await sendTransaction(account, chainId, txParams, gasSpeed);
        import("../activity")
          .then(({ pushActivityItem }) =>
            pushActivityItem(account.address, chainId, {
              hash: result,
              from: account.address,
              to: txParams.to ?? "",
              value: txParams.value ? String(BigInt(txParams.value)) : "0",
              ts: Math.floor(Date.now() / 1000),
              error: false,
              method: txParams.data?.slice(0, 10) ?? "",
              fn: "",
              block: 0,
              transfers: [],
              decoded: null,
              events: [],
            }),
          )
          .catch((e) => {
            bgLog("[activity] pushActivityItem failed:", e);
          });
        break;
      }
      case "eth_signTransaction": {
        const txParams = params[0] as TransactionParams;
        result = await signTransaction(account, chainId, txParams, gasSpeed);
        break;
      }
      case "personal_sign": {
        const [message] = params as [string, Address];
        result = await personalSign(account, message);
        break;
      }
      case "eth_sign": {
        const [, hash] = params as [Address, `0x${string}`];
        result = await ethSign(account, hash);
        break;
      }
      case "eth_signTypedData_v4":
      case "eth_signTypedData": {
        result = await signTypedDataV4(account, params as [Address, string]);
        break;
      }
      default:
        rejectPendingApproval(id, `Unsupported method: ${method}`);
        return { ok: false, error: `Unsupported signing method: ${method}` };
    }

    resolvePendingApproval(id, result);
    updateBadge();
    broadcastPendingCount();
    return { ok: true, data: { result } };
  } catch (e) {
    const msg = toErrorMessage(e);
    rejectPendingApproval(id, msg);
    updateBadge();
    broadcastPendingCount();
    return { ok: false, error: msg };
  }
}

export async function handleRpcRequest(
  method: string,
  params: unknown[] | undefined,
  origin: string,
): Promise<MessageResponse> {
  const result = await handleRpc(method, params, { origin });
  return { ok: true, data: result };
}

export async function handleGetPendingApproval(): Promise<MessageResponse> {
  const pending = getPendingApproval();
  if (!pending) return { ok: true, data: null };

  const [meta, etherscanKey, mode] = await Promise.all([
    loadAccountsMeta(),
    getEtherscanApiKey(),
    getStorageMode(),
  ]);
  const activeAccount = meta?.accounts[meta.activeAccountIndex];
  let gasPresets = null;
  let decoded = null;
  let transfers = null;
  let nativeUsdPrice = null;
  let decodedVia: string | null = null;
  let simulatedVia: string | null = null;

  const isTxMethod =
    pending.method === "eth_sendTransaction" || pending.method === "eth_signTransaction";
  const _debug: string[] = [];

  const hasEtherscanKey = !!etherscanKey;
  const hasAlchemyKey = hasRpcProviderKey();

  if (isTxMethod) {
    const txParams = pending.params[0] as TransactionParams;
    _debug.push(
      `method=${pending.method} to=${txParams.to} data=${txParams.data?.slice(0, 20) ?? "none"} value=${txParams.value ?? "none"} chainId=${pending.chainId}`,
    );

    try {
      gasPresets = await estimateGasPresets(pending.chainId, txParams, activeAccount?.address);
      _debug.push("gas: OK");
    } catch (e) {
      _debug.push(`gas: FAIL ${toErrorMessage(e)}`);
    }

    try {
      const [decodeResult, simResult] = await Promise.allSettled([
        decodeTx(txParams, pending.chainId, _debug),
        simulateTx(
          txParams,
          pending.chainId,
          activeAccount?.address ?? ("0x" as Address),
          _debug,
        ),
      ]);

      if (decodeResult.status === "fulfilled") {
        decoded = decodeResult.value.decoded;
        decodedVia = decodeResult.value.via;
      }

      let simTransfers: import("../../shared/types").TokenTransfer[] = [];
      if (simResult.status === "fulfilled" && simResult.value) {
        simTransfers = simResult.value.transfers;
        simulatedVia = simResult.value.via;
      }

      const network = getNetworkConfig(pending.chainId);
      const nativeSymbol = network?.chain.nativeCurrency.symbol ?? "ETH";

      const tokenAddresses = simTransfers
        .map((t) => t.tokenAddress)
        .filter((a): a is string => !!a);

      const priceMap = await fetchPrices(nativeSymbol, pending.chainId, tokenAddresses);

      nativeUsdPrice = priceMap.get("native") ?? null;

      for (const t of simTransfers) {
        if (t.usdValue) continue;
        let price: number | undefined;
        if (!t.tokenAddress) {
          price = nativeUsdPrice ?? undefined;
        } else {
          price = priceMap.get(t.tokenAddress.toLowerCase());
        }
        if (price != null) {
          const val = parseFloat(t.amount) * price;
          t.usdValue = `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      }

      transfers = simTransfers.length > 0 ? simTransfers : null;
    } catch (e) {
      _debug.push(`decode/sim CATCH: ${toErrorMessage(e)}`);
    }
  }

  return {
    ok: true,
    data: {
      approval: pending,
      gasPresets,
      account: activeAccount,
      queueSize: getPendingCount(),
      decoded,
      transfers,
      nativeUsdPrice,
      decodedVia,
      simulatedVia,
      hasEtherscanKey,
      hasRpcProviderKey: hasAlchemyKey,
      storageMode: mode,
      _debug,
    },
  };
}

export async function handleApproveRequest(
  id: string,
  gasSpeed?: GasSpeed,
  password?: string,
): Promise<MessageResponse> {
  return executeApproval(id, gasSpeed, password);
}

export async function handleRejectRequest(id: string): Promise<MessageResponse> {
  const rejected = rejectPendingApproval(id);
  updateBadge();
  broadcastPendingCount();
  if (!rejected) return { ok: false, error: "No matching pending approval" };
  return { ok: true };
}

export async function handleEstimateGas(
  chainId: number,
  tx: TransactionParams,
): Promise<MessageResponse> {
  try {
    const meta = await loadAccountsMeta();
    const fromAddr = meta?.accounts[meta.activeAccountIndex]?.address;
    const presets = await estimateGasPresets(chainId, tx, fromAddr);
    return { ok: true, data: presets };
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
}
