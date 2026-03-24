import { sendMessage } from "@shared/messages";
import type { ActivityItem } from "@shared/types";
import type { ParentProps } from "solid-js";
import { createSignal, Show } from "solid-js";
import { ErrorToast } from "./components/ErrorToast";
import { DevToolbar } from "./mock/DevToolbar";
import { ApiKeySetup } from "./pages/ApiKeySetup";
import { Approve } from "./pages/Approve";
import { ConfirmSeed } from "./pages/ConfirmSeed";
import { ExportPrivateKey } from "./pages/ExportPrivateKey";
import { Home } from "./pages/Home";
import { ImportWallet } from "./pages/ImportWallet";
import { Receive } from "./pages/Receive";
import { Result } from "./pages/Result";
import { SeedPhrase } from "./pages/SeedPhrase";
import { Send } from "./pages/Send";
import { SetPassword } from "./pages/SetPassword";
import { Settings } from "./pages/Settings";
import { ShowRecoveryPhrase } from "./pages/ShowRecoveryPhrase";
import { Welcome } from "./pages/Welcome";
import { HashRouter, navigate, Route } from "./router";
import {
  activeNetworkId,
  fetchState,
  setActivity,
  setActivityHasMore,
  setActivitySource,
} from "./store";

const APPROVAL_METHODS = new Set([
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData_v4",
  "eth_signTypedData",
]);

export const [pendingQueueSize, setPendingQueueSize] = createSignal(0);

try {
  browser.runtime.onMessage.addListener((msg: unknown) => {
    const m = msg as {
      type?: string;
      count?: number;
      args?: string[];
      items?: ActivityItem[];
      source?: string;
      hasMore?: boolean;
      chainId?: number;
    };
    if (m.type === "PENDING_COUNT" && typeof m.count === "number") {
      setPendingQueueSize(m.count);
    } else if (m.type === "BG_LOG" && m.args) {
      // biome-ignore lint/suspicious/noConsole: this IS the logging utility
      console.log("BG_LOG", m.args);
    } else if (m.type === "ACTIVITY_UPDATED" && m.items) {
      if (m.chainId != null && m.chainId !== activeNetworkId()) return;
      setActivity(m.items);
      if (m.source) setActivitySource(m.source as "etherscan" | "rpc" | "cache");
      if (typeof m.hasMore === "boolean") setActivityHasMore(m.hasMore);
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
        navigate("/approve", { replace: true, state: res.data });
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
  setTimeout(() => navigate("/home", { replace: true }), 150);
}

function AppLayout(props: ParentProps) {
  if (!import.meta.env.DEV) {
    sendMessage({ type: "GET_STATE" }).then((stateRes) => {
      if (!stateRes.ok || !stateRes.data?.isInitialized) {
        navigate("/", { replace: true });
        return;
      }

      sendMessage({ type: "GET_PENDING_APPROVAL" }).then((res) => {
        if (res.ok && res.data) {
          if (APPROVAL_METHODS.has(res.data.approval.method)) {
            navigate("/approve", { replace: true, state: res.data });
            return;
          }
        }
        fetchState().then(() => navigate("/home", { replace: true }));
      });
    });
  }

  return (
    <div
      class="relative mx-auto"
      style={{ width: "360px", "min-height": "600px", "max-height": "600px", overflow: "hidden" }}
    >
      <ErrorToast />
      <div class="h-[600px] overflow-y-auto overflow-x-hidden">{props.children}</div>
      <Show when={import.meta.env.DEV}>
        <DevToolbar />
      </Show>
    </div>
  );
}

export function App() {
  return (
    <HashRouter root={AppLayout}>
      <Route path="/" component={Welcome} />
      <Route path="/set-password" component={SetPassword} />
      <Route path="/seed-phrase" component={SeedPhrase} />
      <Route path="/confirm-seed" component={ConfirmSeed} />
      <Route path="/import" component={ImportWallet} />
      <Route path="/api-key-setup" component={ApiKeySetup} />
      <Route path="/home" component={Home} />
      <Route path="/send" component={Send} />
      <Route path="/receive" component={Receive} />
      <Route path="/approve" component={Approve} />
      <Route path="/result" component={Result} />
      <Route path="/settings" component={Settings} />
      <Route path="/export-key" component={ExportPrivateKey} />
      <Route path="/show-phrase" component={ShowRecoveryPhrase} />
      <Route path="*" component={Welcome} />
    </HashRouter>
  );
}
