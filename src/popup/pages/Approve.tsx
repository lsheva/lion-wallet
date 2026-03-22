import { CHAIN_BY_ID, POPUP_ORIGIN } from "@shared/constants";
import { truncateAddress } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { ApprovalData, GasSpeed } from "@shared/types";
import { useNavigate } from "@solidjs/router";
import { Fingerprint, Globe } from "lucide-solid";
import { batch, createEffect, createMemo, createSignal, Match, Show, Switch } from "solid-js";
import {
  closePopup,
  pendingApprovalData,
  routeToNextApprovalOrClose,
  setPendingApprovalData,
} from "../App";
import { DevApprove } from "../components/approve/DevApprove";
import { SignContent } from "../components/approve/SignContent";
import { TxContent } from "../components/approve/TxContent";
import { BottomActions } from "../components/BottomActions";
import { Button } from "../components/Button";
import { ChainIcon } from "../components/ChainIcon";
import { CopyButton } from "../components/CopyButton";
import { Input } from "../components/Input";
import { GasPresetsSkeleton, Skeleton } from "../components/Skeleton";

const TX_METHODS = new Set(["eth_sendTransaction", "eth_signTransaction"]);

export function Approve() {
  const navigate = useNavigate();
  const [data, setData] = createSignal<ApprovalData | null>(null);
  const [gasSpeed, setGasSpeed] = createSignal<GasSpeed>("normal");
  const [showDetails, setShowDetails] = createSignal(false);
  const [showData, setShowData] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [submitting, setSubmitting] = createSignal(false);
  const [password, setPassword] = createSignal("");
  const [authError, setAuthError] = createSignal("");

  const isDev = import.meta.env.DEV;

  const isTx = createMemo(() => {
    const d = data();
    return d ? TX_METHODS.has(d.approval.method) : false;
  });
  const isPopupOrigin = createMemo(() => data()?.approval.origin === POPUP_ORIGIN);
  const isVaultMode = createMemo(() => data()?.storageMode === "vault");

  const title = createMemo(() => {
    const d = data();
    if (!d) return "";
    return isTx()
      ? isPopupOrigin()
        ? "Confirm Send"
        : d.approval.method === "eth_signTransaction"
          ? "Sign Transaction"
          : "Transaction Request"
      : "Signature Request";
  });

  const network = createMemo(() => {
    const d = data();
    return d ? CHAIN_BY_ID.get(d.approval.chainId) : undefined;
  });

  createEffect(() => {
    if (isDev) {
      setLoading(false);
      return;
    }

    const cached = pendingApprovalData();
    if (cached?.approval) {
      batch(() => {
        setData(cached);
        setGasSpeed("normal");
        setShowDetails(false);
        setShowData(false);
        setSubmitting(false);
        setLoading(false);
      });
      return;
    }

    sendMessage({ type: "GET_PENDING_APPROVAL" }).then((res) => {
      if (res.ok && res.data) {
        setData(res.data);
      }
      setLoading(false);
    });
  });

  async function handleConfirm() {
    if (isDev) {
      navigate(isTx() ? "/tx-success" : "/sign-success", { replace: true });
      return;
    }
    const d = data();
    if (!d) return;

    if (isVaultMode() && password().length < 4) {
      setAuthError("Enter your password to continue");
      return;
    }

    setAuthError("");
    setSubmitting(true);
    const res = await sendMessage({
      type: "APPROVE_REQUEST",
      id: d.approval.id,
      ...(isTx() ? { gasSpeed: gasSpeed() } : {}),
      ...(isVaultMode() ? { password: password() } : {}),
    });
    if (
      !res.ok &&
      (res.error === "Wrong password" || res.error === "Authentication failed or cancelled")
    ) {
      setAuthError(res.error);
      setSubmitting(false);
      return;
    }
    setPendingApprovalData(null);
    if (res.ok) {
      const result = res.data?.result;
      if (isTx()) {
        sessionStorage.setItem(
          "txResult",
          JSON.stringify({ hash: result, method: d.approval.method }),
        );
        navigate("/tx-success", { replace: true });
      } else {
        sessionStorage.setItem("signResult", JSON.stringify({ signature: result }));
        navigate("/sign-success", { replace: true });
      }
    } else {
      if (isTx()) {
        sessionStorage.setItem("txResult", JSON.stringify({ error: res.error }));
        navigate("/tx-error", { replace: true });
      } else {
        sessionStorage.setItem("signResult", JSON.stringify({ error: res.error }));
        navigate("/sign-error", { replace: true });
      }
    }
  }

  async function handleReject() {
    if (isDev) {
      navigate("/home", { replace: true });
      return;
    }
    const d = data();
    if (d) {
      await sendMessage({ type: "REJECT_REQUEST", id: d.approval.id });
      setPendingApprovalData(null);
    }
    await routeToNextApprovalOrClose(() => {
      if (isPopupOrigin()) {
        navigate("/home", { replace: true });
      } else {
        closePopup();
      }
    });
  }

  return (
    <>
      <Switch>
        <Match when={loading()}>
          <div class="flex flex-col h-[600px] animate-fade-in">
            <div class="text-center py-3 border-b border-divider">
              <Skeleton width={160} height={18} class="mx-auto" />
            </div>
            <div class="flex items-center justify-between px-4 py-2 border-b border-divider">
              <Skeleton width={100} height={14} />
              <Skeleton width={120} height={14} />
            </div>
            <div class="flex-1 px-4 pt-4 space-y-3">
              <Skeleton variant="card" height={80} />
              <GasPresetsSkeleton />
              <Skeleton variant="card" height={60} />
            </div>
            <div class="px-4 py-4 flex gap-3">
              <Skeleton variant="card" height={44} class="flex-1" />
              <Skeleton variant="card" height={44} class="flex-1" />
            </div>
          </div>
        </Match>
        <Match when={isDev}>
          <DevApprove />
        </Match>
        <Match when={!loading() && !isDev}>
          <Show
            when={data()}
            fallback={
              <div class="flex flex-col items-center justify-center h-[600px] px-4 text-center">
                <p class="text-text-secondary text-sm">No pending request.</p>
                <Button class="mt-4" onClick={() => navigate("/home", { replace: true })}>
                  Back to Wallet
                </Button>
              </div>
            }
          >
            {(d) => (
              <div class="flex flex-col h-[600px]">
                <div class="text-center py-3 border-b border-divider relative">
                  <h1 class="text-base font-semibold text-text-primary">{title()}</h1>
                  <Show when={(d().queueSize ?? 0) > 1}>
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full">
                      +{(d().queueSize ?? 1) - 1} more
                    </span>
                  </Show>
                </div>

                <div class="flex items-center justify-between px-4 py-1.5 text-xs text-text-tertiary border-b border-divider">
                  <div class="flex items-center gap-1.5">
                    <Show when={network()}>
                      {(net) => <ChainIcon chainId={net().id} size={14} />}
                    </Show>
                    <span>{network()?.name ?? `Chain ${d().approval.chainId}`}</span>
                    <Show when={network()?.testnet}>
                      <span class="text-[10px] text-warning font-medium">testnet</span>
                    </Show>
                  </div>
                  <span class="inline-flex items-center gap-1">
                    {d().account.name} · {truncateAddress(d().account.address)}
                    <CopyButton text={d().account.address} size={12} />
                  </span>
                </div>

                <Show when={!isPopupOrigin()}>
                  <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
                    <Globe size={16} class="text-text-tertiary" />
                    <span class="text-sm text-text-secondary">{d().approval.origin}</span>
                  </div>
                </Show>

                <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
                  <Show when={isTx()} fallback={<SignContent data={d()} />}>
                    <TxContent
                      data={d()}
                      gasSpeed={gasSpeed()}
                      setGasSpeed={setGasSpeed}
                      showDetails={showDetails()}
                      setShowDetails={setShowDetails}
                      showData={showData()}
                      setShowData={setShowData}
                    />
                  </Show>
                </div>

                <Show when={isVaultMode()}>
                  <div class="px-4 pt-2">
                    <Input
                      type="password"
                      placeholder="Enter password to sign"
                      value={password()}
                      onInput={(v) => {
                        setPassword(v);
                        setAuthError("");
                      }}
                      error={authError() || undefined}
                    />
                  </div>
                </Show>

                <BottomActions>
                  <Button
                    variant="secondary"
                    onClick={handleReject}
                    fullWidth
                    disabled={submitting()}
                  >
                    Reject
                  </Button>
                  <Button onClick={handleConfirm} fullWidth loading={submitting()}>
                    {isVaultMode() ? (
                      isTx() ? (
                        "Confirm"
                      ) : (
                        "Sign"
                      )
                    ) : (
                      <span class="inline-flex items-center gap-1.5">
                        <Fingerprint size={16} />
                        {isTx() ? "Confirm" : "Sign"}
                      </span>
                    )}
                  </Button>
                </BottomActions>
              </div>
            )}
          </Show>
        </Match>
      </Switch>
    </>
  );
}
