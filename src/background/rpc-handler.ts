import { toErrorMessage } from "@shared/format";
import { type Hex, numberToHex } from "viem";
import { POPUP_ORIGIN } from "../shared/constants";
import { createPendingApproval } from "./approval";
import {
  getActiveNetworkId,
  getNetworkConfig,
  getPublicClient,
  setActiveNetworkId,
} from "./networks";
import { isVaultInitialized, loadAccountsMeta } from "./vault";

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface RpcContext {
  origin: string;
}

type RpcResult = { result: unknown } | { error: RpcError };

const connectedOrigins = new Set<string>();

const SIGNING_METHODS = new Set([
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData_v4",
  "eth_signTypedData",
]);

export function isOriginConnected(origin: string): boolean {
  return connectedOrigins.has(origin);
}

export function disconnectOrigin(origin: string): void {
  connectedOrigins.delete(origin);
}

let onApprovalCreated: (() => void) | null = null;

export function setApprovalCreatedCallback(cb: () => void): void {
  onApprovalCreated = cb;
}

export async function handleRpc(
  method: string,
  params: unknown[] | undefined,
  ctx: RpcContext,
): Promise<RpcResult> {
  try {
    switch (method) {
      case "eth_requestAccounts": {
        if (!(await isVaultInitialized())) {
          return err(4100, "Wallet is not set up");
        }
        const meta = await loadAccountsMeta();
        const accounts = meta?.accounts ?? [];
        if (accounts.length === 0) {
          return err(4100, "No accounts available");
        }
        connectedOrigins.add(ctx.origin);
        return ok(accounts.map((a) => a.address));
      }

      case "eth_accounts": {
        if (!connectedOrigins.has(ctx.origin)) {
          return ok([]);
        }
        const meta = await loadAccountsMeta();
        return ok((meta?.accounts ?? []).map((a) => a.address));
      }

      case "eth_chainId": {
        const chainId = await getActiveNetworkId();
        return ok(numberToHex(chainId));
      }

      case "net_version": {
        const chainId = await getActiveNetworkId();
        return ok(String(chainId));
      }

      case "wallet_switchEthereumChain": {
        const switchParams = params as unknown[];
        if (
          !switchParams?.[0] ||
          typeof (switchParams[0] as Record<string, unknown>).chainId !== "string"
        ) {
          return err(-32602, "Invalid params: expected [{ chainId: '0x...' }]");
        }
        const hexChainId = (switchParams[0] as { chainId: Hex }).chainId;
        const chainId = parseInt(hexChainId, 16);
        const network = getNetworkConfig(chainId);
        if (!network) {
          return err(
            4902,
            `Unrecognized chain ID ${hexChainId}. Try adding the chain using wallet_addEthereumChain first.`,
          );
        }
        await setActiveNetworkId(chainId);
        return ok(null);
      }

      case "wallet_addEthereumChain": {
        const addParams = params as unknown[];
        if (
          !addParams?.[0] ||
          typeof (addParams[0] as Record<string, unknown>).chainId !== "string"
        ) {
          return err(-32602, "Invalid params: expected [{ chainId: '0x...' }]");
        }
        const chainParams = addParams[0] as { chainId: Hex; chainName?: string };
        const chainId = parseInt(chainParams.chainId, 16);
        const existing = getNetworkConfig(chainId);
        if (existing) {
          await setActiveNetworkId(chainId);
          return ok(null);
        }
        return err(4902, "Adding custom chains is not yet supported");
      }

      case "wallet_requestPermissions": {
        if (!(await isVaultInitialized())) {
          return err(4100, "Wallet is not set up");
        }
        const meta = await loadAccountsMeta();
        if (!meta || meta.accounts.length === 0) {
          return err(4100, "No accounts available");
        }
        connectedOrigins.add(ctx.origin);
        return ok([{ parentCapability: "eth_accounts" }]);
      }

      case "wallet_getPermissions": {
        if (connectedOrigins.has(ctx.origin)) {
          return ok([{ parentCapability: "eth_accounts" }]);
        }
        return ok([]);
      }

      case "wallet_revokePermissions": {
        connectedOrigins.delete(ctx.origin);
        return ok(null);
      }

      default:
        break;
    }

    if (SIGNING_METHODS.has(method)) {
      const isPopup = ctx.origin === POPUP_ORIGIN;
      if (!isPopup && !connectedOrigins.has(ctx.origin)) {
        return err(4100, "Unauthorized — connect first via eth_requestAccounts");
      }

      const chainId = await getActiveNetworkId();
      const { promise } = createPendingApproval(method, params ?? [], ctx.origin, chainId);

      if (isPopup) {
        return ok({ pending: true });
      }

      if (onApprovalCreated) onApprovalCreated();

      return promise;
    }

    return proxyToRpc(method, params);
  } catch (e) {
    return err(-32603, toErrorMessage(e));
  }
}

async function proxyToRpc(method: string, params: unknown[] | undefined): Promise<RpcResult> {
  const chainId = await getActiveNetworkId();
  const client = getPublicClient(chainId);
  const transport = client.transport as { url?: string };
  const rpcUrl = transport.url ?? getNetworkConfig(chainId)?.chain.rpcUrls.default.http[0];

  if (!rpcUrl) {
    return err(-32603, "No RPC URL configured for current chain");
  }

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: params ?? [],
    }),
  });

  const json = (await response.json()) as {
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
  };

  if (json.error) {
    return { error: { code: json.error.code, message: json.error.message, data: json.error.data } };
  }

  return ok(json.result);
}

function ok(result: unknown): RpcResult {
  return { result };
}

function err(code: number, message: string, data?: unknown): RpcResult {
  return { error: { code, message, data } };
}
