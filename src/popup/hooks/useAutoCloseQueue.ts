import { useEffect, useRef, useState } from "preact/hooks";
import { closePopup, pendingQueueSize, routeToNextApprovalOrClose } from "../App";

/**
 * Auto-close countdown that fires when there are queued approvals.
 * Returns `{ autoCloseIn, queueSize, dismiss }` for the result page UI.
 */
export function useAutoCloseQueue(opts: { skip?: boolean } = {}) {
  const isDev = import.meta.env.DEV;
  const queueSize = pendingQueueSize.value;
  const [autoCloseIn, setAutoCloseIn] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (isDev || opts.skip || queueSize <= 0) return;
    setAutoCloseIn(5);
    let seconds = 5;
    timerRef.current = setInterval(() => {
      seconds--;
      setAutoCloseIn(seconds);
      if (seconds <= 0) {
        clearInterval(timerRef.current);
        routeToNextApprovalOrClose(closePopup);
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isDev, opts.skip, queueSize]);

  const dismiss = () => {
    clearInterval(timerRef.current);
    if (queueSize > 0) {
      routeToNextApprovalOrClose(closePopup);
    } else {
      closePopup();
    }
  };

  return { autoCloseIn, queueSize, dismiss };
}
