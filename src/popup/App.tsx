import { sendMessage } from "@shared/messages";
import type { ActivityItem, ApprovalData } from "@shared/types";
import { HashRouter, type Navigator, Route, useNavigate } from "@solidjs/router";
import type { ParentProps } from "solid-js";
import { createSignal, lazy, Show } from "solid-js";

import { DevToolbar } from "./mock/DevToolbar";
import { fetchState, setActivity, setActivityHasMore, setActivitySource } from "./store";

const ApiKeySetup = lazy(() =>
  import("./pages/ApiKeySetup").then((m) => ({ default: m.ApiKeySetup })),
);
const Approve = lazy(() => import("./pages/Approve").then((m) => ({ default: m.Approve })));
const ConfirmSeed = lazy(() =>
  import("./pages/ConfirmSeed").then((m) => ({ default: m.ConfirmSeed })),
);
const ExportPrivateKey = lazy(() =>
  import("./pages/ExportPrivateKey").then((m) => ({ default: m.ExportPrivateKey })),
);
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const ImportWallet = lazy(() =>
  import("./pages/ImportWallet").then((m) => ({ default: m.ImportWallet })),
);
const Receive = lazy(() => import("./pages/Receive").then((m) => ({ default: m.Receive })));
const SeedPhrase = lazy(() =>
  import("./pages/SeedPhrase").then((m) => ({ default: m.SeedPhrase })),
);
const Send = lazy(() => import("./pages/Send").then((m) => ({ default: m.Send })));
const SetPassword = lazy(() =>
  import("./pages/SetPassword").then((m) => ({ default: m.SetPassword })),
);
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
const ShowRecoveryPhrase = lazy(() =>
  import("./pages/ShowRecoveryPhrase").then((m) => ({ default: m.ShowRecoveryPhrase })),
);
const SignResult = lazy(() =>
  import("./pages/SignResult").then((m) => ({ default: m.SignResult })),
);
const TxResult = lazy(() => import("./pages/TxResult").then((m) => ({ default: m.TxResult })));
const Welcome = lazy(() => import("./pages/Welcome").then((m) => ({ default: m.Welcome })));

const APPROVAL_METHODS = new Set([
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData_v4",
  "eth_signTypedData",
]);

export const [pendingApprovalData, setPendingApprovalData] = createSignal<ApprovalData | null>(
  null,
);
export const [pendingQueueSize, setPendingQueueSize] = createSignal(0);

let navigateFn: Navigator | undefined;

export function setNavigator(nav: Navigator): void {
  navigateFn = nav;
}

function navigateTo(path: string, replace = false): void {
  navigateFn?.(path, { replace });
}

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
      setPendingQueueSize(m.count);
    } else if (m.type === "BG_LOG" && m.args) {
    } else if (m.type === "ACTIVITY_UPDATED" && m.items) {
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
        setPendingApprovalData(res.data);
        navigateTo("/approve", true);
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
  setTimeout(() => navigateTo("/home", true), 150);
}

function AppLayout(props: ParentProps) {
  const navigate = useNavigate();
  setNavigator(navigate);

  if (!import.meta.env.DEV) {
    sendMessage({ type: "GET_STATE" }).then((stateRes) => {
      if (!stateRes.ok || !stateRes.data?.isInitialized) {
        navigate("/", { replace: true });
        return;
      }

      sendMessage({ type: "GET_PENDING_APPROVAL" }).then((res) => {
        if (res.ok && res.data) {
          if (APPROVAL_METHODS.has(res.data.approval.method)) {
            setPendingApprovalData(res.data);
            navigate("/approve", { replace: true });
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
      <Route path="/tx-success" component={() => <TxResult status="success" />} />
      <Route path="/tx-error" component={() => <TxResult status="error" />} />
      <Route path="/sign-success" component={() => <SignResult status="success" />} />
      <Route path="/sign-error" component={() => <SignResult status="error" />} />
      <Route path="/settings" component={Settings} />
      <Route path="/export-key" component={ExportPrivateKey} />
      <Route path="/show-phrase" component={ShowRecoveryPhrase} />
      <Route path="*" component={Welcome} />
    </HashRouter>
  );
}
