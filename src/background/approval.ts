import type { RpcError } from "./rpc-handler";
import type { PendingApproval } from "../shared/types";

interface PendingEntry {
  approval: PendingApproval;
  resolve: (result: unknown) => void;
  reject: (error: RpcError) => void;
}

let pendingEntry: PendingEntry | null = null;
let idCounter = 0;

export function createPendingApproval(
  method: string,
  params: unknown[],
  origin: string,
  chainId: number,
): { id: string; promise: Promise<{ result: unknown } | { error: RpcError }> } {
  if (pendingEntry) {
    pendingEntry.reject({ code: 4001, message: "Request superseded by new approval" });
    pendingEntry = null;
  }

  const id = `approval-${++idCounter}-${Date.now()}`;

  const promise = new Promise<{ result: unknown } | { error: RpcError }>((resolve) => {
    pendingEntry = {
      approval: { id, method, params, origin, timestamp: Date.now(), chainId },
      resolve: (result: unknown) => resolve({ result }),
      reject: (error: RpcError) => resolve({ error }),
    };
  });

  return { id, promise };
}

export function getPendingApproval(): PendingApproval | null {
  return pendingEntry?.approval ?? null;
}

export function resolvePendingApproval(id: string, result: unknown): boolean {
  if (!pendingEntry || pendingEntry.approval.id !== id) return false;
  pendingEntry.resolve(result);
  pendingEntry = null;
  return true;
}

export function rejectPendingApproval(id: string, reason?: string): boolean {
  if (!pendingEntry || pendingEntry.approval.id !== id) return false;
  pendingEntry.reject({ code: 4001, message: reason ?? "User rejected the request" });
  pendingEntry = null;
  return true;
}

export function clearAllPending(): void {
  if (pendingEntry) {
    pendingEntry.reject({ code: 4001, message: "Wallet locked" });
    pendingEntry = null;
  }
}
