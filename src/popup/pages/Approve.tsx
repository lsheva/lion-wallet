import { ERC20_TRANSFER_SELECTOR } from "@shared/abis";
import { CHAIN_BY_ID, POPUP_ORIGIN } from "@shared/constants";
import { truncateAddress } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { ApprovalData, GasSpeed } from "@shared/types";
import { Fingerprint, Globe } from "lucide-solid";
import { createEffect, createMemo, createSignal, Match, Show, Switch } from "solid-js";
import { closePopup, routeToNextApprovalOrClose } from "../App";
import { SignContent } from "../components/approve/SignContent";
import { TxContent } from "../components/approve/TxContent";
import { BottomActions } from "../components/BottomActions";
import { Button } from "../components/Button";
import { ChainIcon } from "../components/ChainIcon";
import { CopyButton } from "../components/CopyButton";
import { Input } from "../components/Input";
import { GasPresetsSkeleton, Skeleton } from "../components/Skeleton";
import { useNavigate, useNavState } from "../router";

const TX_METHODS = new Set(["eth_sendTransaction", "eth_signTransaction"]);

const CONNECT_METHODS = new Set(["eth_requestAccounts", "wallet_requestPermissions"]);

function SiteIcon(props: { url?: string }) {
  const [broken, setBroken] = createSignal(false);
  createEffect(() => {
    props.url;
    setBroken(false);
  });
  return (
    <Show
      when={props.url && !broken()}
      fallback={
        <div class="w-9 h-9 rounded-lg bg-base border border-divider flex items-center justify-center shrink-0">
          <Globe size={18} class="text-text-tertiary" />
        </div>
      }
    >
      <img
        src={props.url}
        alt=""
        class="w-9 h-9 rounded-lg bg-base object-contain shrink-0 border border-divider"
        onError={() => setBroken(true)}
      />
    </Show>
  );
}

export function Approve() {
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  const cached = isDev ? null : useNavState<ApprovalData>();
  const initialData = cached?.approval ? cached : null;

  const [data, setData] = createSignal<ApprovalData | null>(initialData);
  const [gasSpeed, setGasSpeed] = createSignal<GasSpeed>("normal");
  const [showDetails, setShowDetails] = createSignal(false);
  const [showData, setShowData] = createSignal(false);
  const [loading, setLoading] = createSignal(!isDev && !initialData);
  const [enriching, setEnriching] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [password, setPassword] = createSignal("");
  const [authError, setAuthError] = createSignal("");

  function enrichApproval(d: ApprovalData) {
    if (isDev) return;
    if (CONNECT_METHODS.has(d.approval.method)) return;
    const isTxMethod = TX_METHODS.has(d.approval.method);
    if (!isTxMethod) return;

    setEnriching(true);
    sendMessage({ type: "ENRICH_APPROVAL", id: d.approval.id }).then((res) => {
      if (res.ok && res.data) {
        setData((prev) => (prev ? { ...prev, ...res.data } : prev));
      }
      setEnriching(false);
    });
  }

  if (initialData) {
    enrichApproval(initialData);
  } else if (!isDev) {
    sendMessage({ type: "GET_PENDING_APPROVAL" }).then((res) => {
      if (res.ok && res.data) {
        setData(res.data);
        enrichApproval(res.data);
      }
      setLoading(false);
    });
  }

  const isTx = createMemo(() => {
    const d = data();
    return d ? TX_METHODS.has(d.approval.method) : false;
  });
  const isConnect = createMemo(() => {
    const d = data();
    return d ? CONNECT_METHODS.has(d.approval.method) : false;
  });
  const isPopupOrigin = createMemo(() => data()?.approval.origin === POPUP_ORIGIN);
  const isVaultMode = createMemo(() => data()?.storageMode === "vault");

  const title = createMemo(() => {
    const d = data();
    if (!d) return "";
    if (isConnect()) return "Connection request";
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

  /** Gas/simulation failed (e.g. revert) — warn before signing. */
  const txLikelyRevert = createMemo(() => {
    const d = data();
    if (!d || !TX_METHODS.has(d.approval.method)) return false;
    return !!d.gasEstimateError;
  });

  async function handleConfirm() {
    if (isDev) {
      navigate("/result", {
        replace: true,
        state: { kind: isTx() ? "tx" : "sign", status: "success" },
      });
      return;
    }
    const d = data();
    if (!d) return;

    if (isConnect()) {
      setAuthError("");
      setSubmitting(true);
      const res = await sendMessage({ type: "APPROVE_REQUEST", id: d.approval.id });
      setSubmitting(false);
      if (res.ok) {
        await routeToNextApprovalOrClose(() => {
          if (isPopupOrigin()) {
            navigate("/home", { replace: true });
          } else {
            closePopup();
          }
        });
      } else {
        setAuthError(res.error);
      }
      return;
    }

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
    if (res.ok) {
      const result = res.data?.result;
      const kind = isTx() ? "tx" : "sign";
      if (isTx()) {
        const txParams = d.approval.params[0] as { to?: string; data?: string } | undefined;
        let recipient: string | undefined;
        if (!txParams?.data || txParams.data === "0x") {
          recipient = txParams?.to;
        } else if (
          txParams.data.startsWith(ERC20_TRANSFER_SELECTOR) &&
          txParams.data.length >= 74
        ) {
          recipient = `0x${txParams.data.slice(34, 74)}`;
        }
        navigate("/result", {
          replace: true,
          state: {
            kind,
            status: "success",
            hash: result,
            method: d.approval.method,
            chainId: d.approval.chainId,
            recipient,
          },
        });
      } else {
        navigate("/result", {
          replace: true,
          state: { kind, status: "success", signature: result, chainId: d.approval.chainId },
        });
      }
    } else {
      navigate("/result", {
        replace: true,
        state: {
          kind: isTx() ? "tx" : "sign",
          status: "error",
          error: res.error,
          chainId: d.approval.chainId,
        },
      });
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
      <Match when={!loading()}>
        <Show
          when={data()}
          keyed
          fallback={
            <div class="flex flex-col items-center justify-center h-[600px] px-4 text-center">
              <p class="text-text-secondary text-sm">No pending request.</p>
              <Button class="mt-4" onClick={() => navigate("/home", { replace: true })}>
                Back to Wallet
              </Button>
            </div>
          }
        >
          {(_d) => {
            const d = data as () => ApprovalData;
            return (
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
                    <Show keyed when={network()}>
                      {(net) => <ChainIcon chainId={net.id} size={14} />}
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
                  <div class="flex items-center gap-3 px-4 py-2.5 bg-surface border-b border-divider">
                    <SiteIcon url={d().approval.faviconUrl} />
                    <span class="text-sm text-text-secondary break-all">{d().approval.origin}</span>
                  </div>
                </Show>

                <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
                  <Show when={isConnect()}>
                    <div class="rounded-[var(--radius-card)] border border-divider bg-surface px-4 py-3 text-sm text-text-secondary leading-relaxed">
                      <p class="font-medium text-text-primary mb-2">Requested permissions</p>
                      <ul class="list-disc pl-4 space-y-1">
                        <li>View your wallet address</li>
                        <li>Use connected account for transactions (after you approve each one)</li>
                      </ul>
                    </div>
                  </Show>
                  <Show when={!isConnect()}>
                    <Show when={isTx()} fallback={<SignContent data={d()} />}>
                      <TxContent
                        data={d()}
                        enriching={enriching()}
                        gasSpeed={gasSpeed()}
                        setGasSpeed={setGasSpeed}
                        showDetails={showDetails()}
                        setShowDetails={setShowDetails}
                        showData={showData()}
                        setShowData={setShowData}
                      />
                    </Show>
                  </Show>
                </div>

                <Show when={isVaultMode() && !isConnect()}>
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
                  <Button
                    variant={txLikelyRevert() ? "danger" : "primary"}
                    onClick={handleConfirm}
                    fullWidth
                    loading={submitting()}
                  >
                    {isConnect() ? (
                      "Connect"
                    ) : isVaultMode() ? (
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
            );
          }}
        </Show>
      </Match>
    </Switch>
  );
}
