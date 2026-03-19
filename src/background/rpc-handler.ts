import { numberToHex, type Hex } from "viem";
import * as wallet from "./wallet";
import {
  getPublicClient,
  getActiveNetworkId,
  setActiveNetworkId,
  getNetworkConfig,
} from "./networks";
import { createPendingApproval } from "./approval";
import { isVaultInitialized } from "./vault";
import { POPUP_ORIGIN } from "../shared/constants";

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

const UNLOCK_TIMEOUT_MS = 120_000;
const unlockWaiters = new Set<{ resolve: () => void; reject: (e: RpcError) => void }>();

export function notifyUnlocked(): void {
  for (const w of unlockWaiters) w.resolve();
  unlockWaiters.clear();
}

export function rejectUnlockWaiters(): void {
  for (const w of unlockWaiters) w.reject({ code: 4001, message: "User rejected the request" });
  unlockWaiters.clear();
}

function waitForUnlock(): Promise<RpcResult | null> {
  return new Promise<RpcResult | null>((resolve) => {
    const timer = setTimeout(() => {
      unlockWaiters.delete(entry);
      resolve(err(4001, "Unlock timed out"));
    }, UNLOCK_TIMEOUT_MS);

    const entry = {
      resolve: () => { clearTimeout(timer); resolve(null); },
      reject: (e: RpcError) => { clearTimeout(timer); resolve({ error: e }); },
    };
    unlockWaiters.add(entry);

    if (onApprovalCreated) onApprovalCreated();
  });
}

export async function handleRpc(
  method: string,
  params: unknown[] | undefined,
  ctx: RpcContext,
): Promise<RpcResult> {
  try {
    switch (method) {
      case "eth_requestAccounts": {
        if (!wallet.isUnlocked()) {
          if (!(await isVaultInitialized())) {
            return err(4100, "Wallet is not set up");
          }
          const lockErr = await waitForUnlock();
          if (lockErr) return lockErr;
        }
        const accounts = wallet.getAccounts();
        if (accounts.length === 0) {
          return err(4100, "No accounts available");
        }
        connectedOrigins.add(ctx.origin);
        return ok(accounts.map((a) => a.address));
      }

      case "eth_accounts": {
        if (!wallet.isUnlocked() || !connectedOrigins.has(ctx.origin)) {
          return ok([]);
        }
        return ok(wallet.getAccounts().map((a) => a.address));
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
        const [{ chainId: hexChainId }] = params as [{ chainId: Hex }];
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
        const [chainParams] = params as [{ chainId: Hex; chainName?: string }];
        const chainId = parseInt(chainParams.chainId, 16);
        const existing = getNetworkConfig(chainId);
        if (existing) {
          await setActiveNetworkId(chainId);
          return ok(null);
        }
        return err(4902, "Adding custom chains is not yet supported");
      }

      case "wallet_requestPermissions": {
        if (!wallet.isUnlocked()) {
          if (!(await isVaultInitialized())) {
            return err(4100, "Wallet is not set up");
          }
          const lockErr = await waitForUnlock();
          if (lockErr) return lockErr;
        }
        const accounts = wallet.getAccounts();
        if (accounts.length === 0) {
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
      if (!wallet.isUnlocked()) {
        return err(4100, "Wallet is locked");
      }
      const isPopup = ctx.origin === POPUP_ORIGIN;
      if (!isPopup && !connectedOrigins.has(ctx.origin)) {
        return err(4100, "Unauthorized — connect first via eth_requestAccounts");
      }

      const chainId = await getActiveNetworkId();
      const { promise } = createPendingApproval(
        method,
        params ?? [],
        ctx.origin,
        chainId,
      );

      if (isPopup) {
        return ok({ pending: true });
      }

      if (onApprovalCreated) onApprovalCreated();

      return promise;
    }

    return proxyToRpc(method, params);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return err(-32603, message);
  }
}

async function proxyToRpc(
  method: string,
  params: unknown[] | undefined,
): Promise<RpcResult> {
  const chainId = await getActiveNetworkId();
  const client = getPublicClient(chainId);
  const transport = client.transport as { url?: string };
  const rpcUrl = transport.url ?? getNetworkConfig(chainId)?.rpcUrl;

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
