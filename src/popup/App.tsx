import { signal } from "@preact/signals";
import { sendMessage } from "@shared/messages";
import type { ActivityItem, ApprovalData } from "@shared/types";
import { useEffect } from "preact/hooks";
import Router, { Route, route } from "preact-router";
import browser from "webextension-polyfill";
import { DevToolbar } from "./mock/DevToolbar";
import { ApiKeySetup } from "./pages/ApiKeySetup";
import { Approve } from "./pages/Approve";
import { ConfirmSeed } from "./pages/ConfirmSeed";
import { ExportPrivateKey } from "./pages/ExportPrivateKey";
import { Home } from "./pages/Home";
import { ImportWallet } from "./pages/ImportWallet";
import { Receive } from "./pages/Receive";
import { SeedPhrase } from "./pages/SeedPhrase";
import { Send } from "./pages/Send";
import { SetPassword } from "./pages/SetPassword";
import { Settings } from "./pages/Settings";
import { ShowRecoveryPhrase } from "./pages/ShowRecoveryPhrase";
import { SignResult } from "./pages/SignResult";
import { TxResult } from "./pages/TxResult";
import { Welcome } from "./pages/Welcome";
import { activity, activityHasMore, activitySource, fetchState } from "./store";

const APPROVAL_METHODS = new Set([
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData_v4",
  "eth_signTypedData",
]);

export const pendingApprovalData = signal<ApprovalData | null>(null);
export const pendingQueueSize = signal(0);

try {
  browser.runtime.onMessage.addListener((msg: unknown) => {
    const m = msg as {
      type?: string;
      count?: number;
      args?: string[];
      items?: ActivityItem[];
      source?: string;
      hasMore?: boolean;
    };
    if (m.type === "PENDING_COUNT" && typeof m.count === "number") {
      pendingQueueSize.value = m.count;
    } else if (m.type === "BG_LOG" && m.args) {
      console.log("[bg]", ...m.args);
    } else if (m.type === "ACTIVITY_UPDATED" && m.items) {
      activity.value = m.items;
      if (m.source) activitySource.value = m.source as "etherscan" | "rpc" | "cache";
      if (typeof m.hasMore === "boolean") activityHasMore.value = m.hasMore;
    }
  });
} catch {
  /* dev mode — no extension runtime */
}

export async function routeToNextApprovalOrClose(fallback: () => void): Promise<void> {
  try {
    const res = await sendMessage({ type: "GET_PENDING_APPROVAL" });
    if (res.ok && res.data) {
      if (APPROVAL_METHODS.has(res.data.approval.method)) {
        pendingApprovalData.value = res.data;
        route("/approve", true);
        return;
      }
    }
  } catch {
    /* background unavailable */
  }
  fallback();
}

/** Dismiss the toolbar popover. Do not use `browser.windows.remove` here — on Safari, `getCurrent` can refer to the main browser window and would close Safari entirely. */
export function closePopup(): void {
  window.close();
  setTimeout(() => route("/home", true), 150);
}

export function App() {
  useEffect(() => {
    if (import.meta.env.DEV) return;

    sendMessage({ type: "GET_STATE" }).then((stateRes) => {
      if (!stateRes.ok || !stateRes.data?.isInitialized) {
        route("/", true);
        return;
      }

      sendMessage({ type: "GET_PENDING_APPROVAL" }).then((res) => {
        if (res.ok && res.data) {
          if (APPROVAL_METHODS.has(res.data.approval.method)) {
            pendingApprovalData.value = res.data;
            route("/approve", true);
            return;
          }
        }
        fetchState().then(() => route("/home", true));
      });
    });
  }, []);

  return (
    <div
      class="relative mx-auto bg-base"
      style={{ width: 360, minHeight: 600, maxHeight: 600, overflow: "hidden" }}
    >
      <div class="h-[600px] overflow-y-auto overflow-x-hidden">
        <Router>
          <Route path="/" component={Welcome} />
          <Route default component={Welcome} />
          <Route path="/set-password" component={SetPassword} />
          <Route path="/seed-phrase" component={SeedPhrase} />
          <Route path="/confirm-seed" component={ConfirmSeed} />
          <Route path="/import" component={ImportWallet} />
          <Route path="/api-key-setup" component={ApiKeySetup} />
          <Route path="/home" component={Home} />
          <Route path="/send" component={Send} />
          <Route path="/receive" component={Receive} />
          <Route path="/approve" component={Approve} />
          <Route path="/tx-success" component={() => <TxResult status="success" />} />
          <Route path="/tx-error" component={() => <TxResult status="error" />} />
          <Route path="/sign-success" component={() => <SignResult status="success" />} />
          <Route path="/sign-error" component={() => <SignResult status="error" />} />
          <Route path="/settings" component={Settings} />
          <Route path="/export-key" component={ExportPrivateKey} />
          <Route path="/show-phrase" component={ShowRecoveryPhrase} />
        </Router>
      </div>
      {import.meta.env.DEV && <DevToolbar />}
    </div>
  );
}
