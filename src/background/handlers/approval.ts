import { ERC20_TRANSFER_SELECTOR } from "@shared/abis";
import { formatGasEstimateError, toErrorMessage } from "@shared/format";
import type { Address, Hex } from "viem";
import { formatEther } from "viem/utils";
import type { MessageResponse } from "../../shared/messages";
import type { GasSpeed, TransactionParams } from "../../shared/types";
import { getActiveAccount } from "../account-utils";
import { pushActivityItem } from "../activity";
import { pushRecentAddress } from "../address-book";
import {
  getPendingApproval,
  getPendingCount,
  rejectPendingApproval,
  resolvePendingApproval,
} from "../approval";
import { broadcastPendingCount, updateBadge } from "../broadcast";
import { addConnectedOrigin } from "../connected-origins";
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
import { retrieveHdMnemonicForKeyring, retrieveImportedKey } from "./wallet";

function buildSigningReason(method: string, params: unknown[], chainId: number): string {
  const net = getNetworkConfig(chainId);
  const networkName = net?.name ?? `Chain ${chainId}`;

  switch (method) {
    case "eth_sendTransaction":
    case "eth_signTransaction": {
      const tx = params[0] as TransactionParams | undefined;
      if (tx?.value && BigInt(tx.value) > 0n) {
        const symbol = net?.nativeCurrency?.symbol ?? "ETH";
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

  if (pending.method === "eth_requestAccounts") {
    try {
      const meta = await loadAccountsMeta();
      if (!meta) return { ok: false, error: "No accounts found" };
      await addConnectedOrigin(pending.origin);
      const addresses = meta.accounts.map((a) => a.address);
      resolvePendingApproval(id, addresses);
      updateBadge();
      broadcastPendingCount();
      return { ok: true, data: { result: addresses } };
    } catch (e) {
      const msg = toErrorMessage(e);
      rejectPendingApproval(id, msg);
      updateBadge();
      broadcastPendingCount();
      return { ok: false, error: msg };
    }
  }

  if (pending.method === "wallet_requestPermissions") {
    try {
      await addConnectedOrigin(pending.origin);
      const perms = [{ parentCapability: "eth_accounts" as const }];
      resolvePendingApproval(id, perms);
      updateBadge();
      broadcastPendingCount();
      return { ok: true, data: { result: perms } };
    } catch (e) {
      const msg = toErrorMessage(e);
      rejectPendingApproval(id, msg);
      updateBadge();
      broadcastPendingCount();
      return { ok: false, error: msg };
    }
  }

  try {
    const mode = await getStorageMode();
    const meta = await loadAccountsMeta();
    if (!meta) return { ok: false, error: "No accounts found" };

    const { method, params, chainId } = pending;
    const signingReason = buildSigningReason(method, params, chainId);

    const active = getActiveAccount(meta);
    if (!active) return { ok: false, error: "No active account" };
    let importedKey: Hex | undefined;
    let hdMnemonic = "";
    if (active.path === "imported") {
      importedKey =
        (await retrieveImportedKey(mode, active.address, password, signingReason)) ?? undefined;
    } else {
      hdMnemonic = await retrieveHdMnemonicForKeyring(
        mode,
        active.keyringId,
        password,
        signingReason,
      );
    }

    const account = getAccountForSigning(active, hdMnemonic, importedKey);

    let result: string;

    switch (method) {
      case "eth_sendTransaction": {
        const txParams = params[0] as TransactionParams;
        result = await sendTransaction(account, chainId, txParams, gasSpeed);
        void pushActivityItem(account.address, chainId, {
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
        }).catch((e) => {
          bgLog("[activity] pushActivityItem failed:", e);
        });
        {
          let recipient: Address | undefined;
          if (!txParams.data || txParams.data === "0x") {
            recipient = txParams.to;
          } else if (
            txParams.data.startsWith(ERC20_TRANSFER_SELECTOR) &&
            txParams.data.length >= 74
          ) {
            recipient = `0x${txParams.data.slice(34, 74)}` as Address;
          }
          if (recipient) {
            void pushRecentAddress(account.address, recipient).catch((e) => {
              bgLog("[address-book] pushRecentAddress failed:", e);
            });
          }
        }
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
  faviconUrl?: string,
): Promise<MessageResponse> {
  const extras = faviconUrl ? { faviconUrl } : undefined;
  const result = await handleRpc(method, params, { origin, extras });
  return { ok: true, data: result };
}

export async function handleGetPendingApproval(): Promise<MessageResponse> {
  const pending = getPendingApproval();
  if (!pending) return { ok: true, data: null };

  const [meta, mode] = await Promise.all([loadAccountsMeta(), getStorageMode()]);
  const activeAccount = meta ? getActiveAccount(meta) : undefined;

  return {
    ok: true,
    data: {
      approval: pending,
      account: activeAccount,
      queueSize: getPendingCount(),
      storageMode: mode,
    },
  };
}

export async function handleEnrichApproval(id: string): Promise<MessageResponse> {
  const pending = getPendingApproval();
  if (!pending || pending.id !== id) return { ok: true, data: null };

  if (pending.method === "eth_requestAccounts" || pending.method === "wallet_requestPermissions") {
    return { ok: true, data: null };
  }

  const [meta, etherscanKey] = await Promise.all([loadAccountsMeta(), getEtherscanApiKey()]);
  const activeAccount = meta ? getActiveAccount(meta) : undefined;

  let gasPresets = null;
  let gasEstimateError: string | null = null;
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

    // Use pre-filled enrichment when available (e.g. multi-send queued txs)
    if (pending.prefilled) {
      decoded = pending.prefilled.decoded ?? null;
      transfers = pending.prefilled.transfers ?? null;
    }

    _debug.push(
      `method=${pending.method} to=${txParams.to} data=${txParams.data?.slice(0, 20) ?? "none"} value=${txParams.value ?? "none"} chainId=${pending.chainId}`,
    );

    try {
      gasPresets = await estimateGasPresets(pending.chainId, txParams, activeAccount?.address);
      _debug.push("gas: OK");
    } catch (e) {
      gasEstimateError = formatGasEstimateError(e);
      _debug.push(`gas: FAIL ${gasEstimateError}`);
    }

    if (!pending.prefilled) {
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
        const nativeSymbol = network?.nativeCurrency.symbol ?? "ETH";

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
  }

  for (const line of _debug) bgLog("[enrich]", line);

  return {
    ok: true,
    data: {
      gasPresets,
      gasEstimateError,
      decoded,
      transfers,
      nativeUsdPrice,
      decodedVia,
      simulatedVia,
      hasEtherscanKey,
      hasRpcProviderKey: hasAlchemyKey,
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
    const fromAddr = meta ? getActiveAccount(meta)?.address : undefined;
    const presets = await estimateGasPresets(chainId, tx, fromAddr);
    return { ok: true, data: presets };
  } catch (e) {
    return { ok: false, error: formatGasEstimateError(e) };
  }
}
