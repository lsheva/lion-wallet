import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { closePopup, pendingQueueSize, routeToNextApprovalOrClose } from "../App";

/**
 * Auto-close countdown that fires when there are queued approvals.
 * Returns `{ autoCloseIn, queueSize, dismiss }` for the result page UI.
 */
export function useAutoCloseQueue(opts: { skip?: boolean } = {}) {
  const isDev = import.meta.env.DEV;
  const [autoCloseIn, setAutoCloseIn] = createSignal<number | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;

  createEffect(
    on(pendingQueueSize, (qSize) => {
      if (isDev || opts.skip || qSize <= 0) return;
      setAutoCloseIn(5);
      let seconds = 5;
      timer = setInterval(() => {
        seconds--;
        setAutoCloseIn(seconds);
        if (seconds <= 0) {
          clearInterval(timer);
          routeToNextApprovalOrClose(closePopup);
        }
      }, 1000);
      onCleanup(() => clearInterval(timer));
    }),
  );

  const dismiss = () => {
    clearInterval(timer);
    if (pendingQueueSize() > 0) {
      routeToNextApprovalOrClose(closePopup);
    } else {
      closePopup();
    }
  };

  return { autoCloseIn, queueSize: pendingQueueSize, dismiss };
}
