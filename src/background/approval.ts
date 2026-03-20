import type { PendingApproval } from "../shared/types";
import type { RpcError } from "./rpc-handler";

interface PendingEntry {
  approval: PendingApproval;
  resolve: (result: unknown) => void;
  reject: (error: RpcError) => void;
}

const pendingQueue = new Map<string, PendingEntry>();
let idCounter = 0;

export function createPendingApproval(
  method: string,
  params: unknown[],
  origin: string,
  chainId: number,
): { id: string; promise: Promise<{ result: unknown } | { error: RpcError }> } {
  const id = `approval-${++idCounter}-${Date.now()}`;

  const promise = new Promise<{ result: unknown } | { error: RpcError }>((resolve) => {
    pendingQueue.set(id, {
      approval: { id, method, params, origin, timestamp: Date.now(), chainId },
      resolve: (result: unknown) => resolve({ result }),
      reject: (error: RpcError) => resolve({ error }),
    });
  });

  return { id, promise };
}

export function getPendingApproval(): PendingApproval | null {
  const first = pendingQueue.values().next();
  return first.done ? null : first.value.approval;
}

export function getPendingCount(): number {
  return pendingQueue.size;
}

export function resolvePendingApproval(id: string, result: unknown): boolean {
  const entry = pendingQueue.get(id);
  if (!entry) return false;
  entry.resolve(result);
  pendingQueue.delete(id);
  return true;
}

export function rejectPendingApproval(id: string, reason?: string): boolean {
  const entry = pendingQueue.get(id);
  if (!entry) return false;
  entry.reject({ code: 4001, message: reason ?? "User rejected the request" });
  pendingQueue.delete(id);
  return true;
}

export function clearAllPending(): void {
  for (const entry of pendingQueue.values()) {
    entry.reject({ code: 4001, message: "Wallet locked" });
  }
  pendingQueue.clear();
}
