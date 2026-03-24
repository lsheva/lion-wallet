import { createSignal } from "solid-js";

export interface ToastMessage {
  id: number;
  message: string;
  details?: string;
}

let nextId = 0;
const AUTO_DISMISS_MS = 8000;

export const [toasts, setToasts] = createSignal<ToastMessage[]>([]);

export function showError(message: string, details?: string): void {
  const id = nextId++;
  setToasts((prev) => [...prev, { id, message, details }]);
  setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
}

export function dismissToast(id: number): void {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}
