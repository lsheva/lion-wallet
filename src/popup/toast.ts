import { createSignal } from "solid-js";

export interface ToastMessage {
  id: number;
  message: string;
  details?: string;
}

let nextId = 0;

export const [toasts, setToasts] = createSignal<ToastMessage[]>([]);

export function showError(message: string, details?: string): void {
  console.error("[Error]", details?.trim() ? { message, details: details.trim() } : message);

  const id = nextId++;
  setToasts((prev) => [...prev, { id, message, details }]);
}

export function dismissToast(id: number): void {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}
