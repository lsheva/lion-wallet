/** Registers the real background bundle as a site service worker (pnpm dev in a normal tab). */
export async function registerDevBackgroundServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.warn("[dev] serviceWorker API not available");
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register(
      new URL("./dev-background-sw.ts", import.meta.url),
      {
        type: "module",
        scope: "/",
      },
    );
    await navigator.serviceWorker.ready;
    registrationForDebug(reg);
    return reg;
  } catch (e) {
    console.error("[dev] service worker registration failed", e);
    throw e;
  }
}

function registrationForDebug(reg: ServiceWorkerRegistration): void {
  if (reg.installing) {
    reg.installing.addEventListener("statechange", function () {
      // biome-ignore lint/suspicious/noConsole: dev diagnostics
      console.log("[dev] SW installing →", this.state);
    });
  }
  // biome-ignore lint/suspicious/noConsole: dev diagnostics
  console.log("[dev] service worker registered:", reg.scope);
}
