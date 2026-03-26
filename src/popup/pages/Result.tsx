import { CHAIN_BY_ID, POPUP_ORIGIN } from "@shared/constants";
import { sendMessage } from "@shared/messages";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-solid";
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { AddressDisplay } from "../components/AddressDisplay";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CopyButton } from "../components/CopyButton";
import { useAutoCloseQueue } from "../hooks/useAutoCloseQueue";
import { useNavigate, useNavState } from "../router";
import { walletState } from "../store";

interface ResultNavState {
  kind: "tx" | "sign";
  status: "success" | "error";
  hash?: string;
  signature?: string;
  error?: string;
  method?: string;
  chainId?: number;
}

const TARGET_CONFIRMATIONS = 12;
const POLL_INTERVAL_MS = 4000;

export function Result() {
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;
  const stored = useNavState<ResultNavState>() ?? { kind: "tx", status: "success" };

  const isTx = () => stored.kind === "tx";
  const isError = () => stored.status === "error";

  const [confirmations, setConfirmations] = createSignal(0);
  const [mined, setMined] = createSignal(false);
  let intervalRef: ReturnType<typeof setInterval> | undefined;
  let receiptBlock: bigint | null = null;

  const txHash = stored.hash;
  const signature = stored.signature;
  const errorMessage = stored.error;

  const explorerUrl = () => {
    if (stored.chainId) {
      return CHAIN_BY_ID.get(stored.chainId)?.blockExplorerUrl;
    }
    return walletState.activeNetwork().blockExplorerUrl;
  };
  const txExplorerUrl = createMemo(() => {
    const url = explorerUrl();
    return url && txHash ? `${url}/tx/${txHash}` : null;
  });

  let rpcFailCount = 0;
  const [rpcError, setRpcError] = createSignal(false);

  async function rpc(method: string, params: unknown[]) {
    const res = await sendMessage({
      type: "RPC_REQUEST",
      id: crypto.randomUUID(),
      method,
      params,
      origin: POPUP_ORIGIN,
    });
    if (!res.ok) {
      rpcFailCount++;
      if (rpcFailCount >= 3) setRpcError(true);
      return null;
    }
    rpcFailCount = 0;
    setRpcError(false);
    return res.data?.result ?? null;
  }

  onMount(() => {
    if (!isTx() || isError() || !txHash) return;

    if (isDev) {
      intervalRef = setInterval(() => {
        setConfirmations((c) => {
          if (c >= TARGET_CONFIRMATIONS) {
            clearInterval(intervalRef);
            setMined(true);
            return TARGET_CONFIRMATIONS;
          }
          return c + 1;
        });
      }, 600);
      return;
    }

    async function poll() {
      if (receiptBlock === null) {
        const receipt = (await rpc("eth_getTransactionReceipt", [txHash])) as {
          blockNumber?: string;
          status?: string;
        } | null;
        if (receipt?.blockNumber) {
          receiptBlock = BigInt(receipt.blockNumber);
          if (receipt.status === "0x0") {
            clearInterval(intervalRef);
            navigate("/result", {
              replace: true,
              state: { ...stored, status: "error", error: "Transaction reverted" },
            });
            return;
          }
        }
      }

      if (receiptBlock !== null) {
        const latestHex = (await rpc("eth_blockNumber", [])) as string | null;
        if (latestHex) {
          const latest = BigInt(latestHex);
          const confs = Number(latest - receiptBlock) + 1;
          const clamped = Math.min(confs, TARGET_CONFIRMATIONS);
          setConfirmations(clamped);
          if (clamped >= TARGET_CONFIRMATIONS) {
            setMined(true);
            clearInterval(intervalRef);
          }
        }
      }
    }

    poll();
    intervalRef = setInterval(poll, POLL_INTERVAL_MS);
  });

  onCleanup(() => {
    if (intervalRef) clearInterval(intervalRef);
  });

  const { autoCloseIn, queueSize, dismiss } = useAutoCloseQueue({ skip: isError() });

  const progressPct = createMemo(() =>
    Math.min((confirmations() / TARGET_CONFIRMATIONS) * 100, 100),
  );

  // --- Error state (both tx and sign) ---
  if (isError()) {
    return (
      <div class="flex flex-col items-center justify-center h-[600px] px-4">
        <div class="w-16 h-16 rounded-full flex items-center justify-center mb-5 bg-danger/10">
          <XCircle size={40} class="text-danger" />
        </div>
        <h1 class="text-xl font-semibold text-text-primary mb-1">
          {isTx() ? "Transaction Failed" : "Signing Failed"}
        </h1>
        <p class="text-sm text-text-secondary text-center mb-6">
          {isTx()
            ? "Something went wrong. The transaction was not submitted."
            : "Something went wrong. The message was not signed."}
        </p>
        <Card class="w-full mb-6">
          <p class="text-xs text-text-secondary mb-1">Error</p>
          <p class="font-mono text-xs text-danger leading-relaxed">
            {errorMessage ??
              (isTx() ? "Unknown error occurred" : "User rejected the signing request")}
          </p>
        </Card>
        <div class="w-full space-y-2">
          <Button onClick={dismiss} size="lg">
            {isDev ? "Back to Wallet" : "Done"}
          </Button>
          <Show when={queueSize() > 0}>
            <p class="text-xs text-text-tertiary text-center">
              {queueSize()} pending request{queueSize() > 1 ? "s" : ""} remaining
            </p>
          </Show>
        </div>
      </div>
    );
  }

  // --- Sign success ---
  if (!isTx()) {
    return (
      <div class="flex flex-col items-center justify-center h-[600px] px-4">
        <div class="w-16 h-16 rounded-full flex items-center justify-center mb-5 bg-success/10">
          <CheckCircle2 size={40} class="text-success" />
        </div>
        <h1 class="text-xl font-semibold text-text-primary mb-1">Message Signed</h1>
        <p class="text-sm text-text-secondary text-center mb-6">
          The message has been signed successfully.
        </p>
        <Show when={signature}>
          <Card class="w-full mb-6">
            <div class="flex items-center justify-between mb-1.5">
              <p class="text-xs text-text-secondary">Signature</p>
              <CopyButton text={signature ?? ""} size={14} />
            </div>
            <p class="font-mono text-[10px] text-text-primary leading-relaxed break-all">
              {signature}
            </p>
          </Card>
        </Show>
        <div class="w-full space-y-2">
          <Button onClick={dismiss} size="lg">
            Done
          </Button>
          <Show when={queueSize() > 0}>
            <p class="text-xs text-text-tertiary text-center">
              {queueSize()} pending request{queueSize() > 1 ? "s" : ""} remaining
              {autoCloseIn() != null && ` · next in ${autoCloseIn()}s`}
            </p>
          </Show>
        </div>
      </div>
    );
  }

  // --- TX success (with confirmation tracking) ---
  return (
    <div class="flex flex-col items-center justify-center h-[600px] px-4">
      <div
        class={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${mined() ? "bg-success/10" : "bg-accent-light"}`}
      >
        <Show when={mined()} fallback={<Loader2 size={36} class="text-accent animate-spin" />}>
          <CheckCircle2 size={40} class="text-success" />
        </Show>
      </div>

      <h1 class="text-xl font-semibold text-text-primary mb-1">
        {mined() ? "Transaction Confirmed" : "Transaction Sent"}
      </h1>
      <p class="text-sm text-text-secondary text-center mb-5">
        {mined()
          ? "Your transaction has been confirmed on the network."
          : rpcError()
            ? "Having trouble reaching the network — still trying..."
            : "Waiting for confirmations..."}
      </p>

      <div class="w-full mb-5">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="text-text-secondary">{mined() ? "Confirmed" : "Confirming"}</span>
          <span class="font-mono text-text-primary">
            {confirmations()}/{TARGET_CONFIRMATIONS} blocks
          </span>
        </div>
        <div class="w-full h-1.5 bg-divider rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all duration-500 ease-out ${mined() ? "bg-success" : "bg-accent"}`}
            style={{ width: `${progressPct()}%` }}
          />
        </div>
      </div>

      <Show when={txHash}>
        <Card class="w-full mb-6">
          <div class="space-y-3">
            <div>
              <p class="text-xs text-text-secondary mb-1">Transaction Hash</p>
              <AddressDisplay address={txHash ?? ""} />
            </div>
            <Show when={txExplorerUrl()}>
              <a
                href={txExplorerUrl() ?? ""}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                <ExternalLink size={12} />
                View on Explorer
              </a>
            </Show>
          </div>
        </Card>
      </Show>

      <div class="w-full space-y-2">
        <Button onClick={dismiss} size="lg" variant={mined() ? "primary" : "secondary"}>
          {mined() ? "Done" : "Dismiss"}
        </Button>
        <Show when={queueSize() > 0}>
          <p class="text-xs text-text-tertiary text-center">
            {queueSize()} pending request{queueSize() > 1 ? "s" : ""} remaining
            {autoCloseIn() != null && ` · next in ${autoCloseIn()}s`}
          </p>
        </Show>
      </div>
    </div>
  );
}
