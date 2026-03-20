import { NETWORK_BY_ID, POPUP_ORIGIN } from "@shared/constants";
import { truncateAddress } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { ApprovalData, GasSpeed } from "@shared/types";
import { Fingerprint, Globe } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { route } from "preact-router";
import { closePopup, pendingApprovalData, routeToNextApprovalOrClose } from "../App";
import { BottomActions } from "../components/BottomActions";
import { Button } from "../components/Button";
import { ChainIcon } from "../components/ChainIcon";
import { CopyButton } from "../components/CopyButton";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { DevApprove } from "../components/approve/DevApprove";
import { SignContent } from "../components/approve/SignContent";
import { TxContent } from "../components/approve/TxContent";
import { walletState } from "../store";

const TX_METHODS = new Set(["eth_sendTransaction", "eth_signTransaction"]);

export function Approve() {
  const [data, setData] = useState<ApprovalData | null>(null);
  const [gasSpeed, setGasSpeed] = useState<GasSpeed>("normal");
  const [showDetails, setShowDetails] = useState(false);
  const [showData, setShowData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const isDev = import.meta.env.DEV;
  const isVaultMode = data?.storageMode === "vault";

  useEffect(() => {
    if (isDev) {
      setLoading(false);
      return;
    }

    const cached = pendingApprovalData.value;
    if (cached?.approval) {
      setData(cached);
      setGasSpeed("normal");
      setShowDetails(false);
      setShowData(false);
      setSubmitting(false);
      setLoading(false);
      return;
    }

    sendMessage({ type: "GET_PENDING_APPROVAL" }).then((res) => {
      if (res.ok && res.data) {
        setData(res.data);
      }
      setLoading(false);
    });
  }, [pendingApprovalData.value]);

  const isTx = data ? TX_METHODS.has(data.approval.method) : false;
  const isPopupOrigin = data?.approval.origin === POPUP_ORIGIN;

  async function handleConfirm() {
    if (isDev) {
      route(isTx ? "/tx-success" : "/sign-success", true);
      return;
    }
    if (!data) return;

    if (isVaultMode && password.length < 4) {
      setAuthError("Enter your password to continue");
      return;
    }

    setAuthError("");
    setSubmitting(true);
    const res = await sendMessage({
      type: "APPROVE_REQUEST",
      id: data.approval.id,
      ...(isTx ? { gasSpeed } : {}),
      ...(isVaultMode ? { password } : {}),
    });
    if (
      !res.ok &&
      (res.error === "Wrong password" || res.error === "Authentication failed or cancelled")
    ) {
      setAuthError(res.error);
      setSubmitting(false);
      return;
    }
    pendingApprovalData.value = null;
    if (res.ok) {
      const result = res.data?.result;
      if (isTx) {
        sessionStorage.setItem(
          "txResult",
          JSON.stringify({ hash: result, method: data.approval.method }),
        );
        route("/tx-success", true);
      } else {
        sessionStorage.setItem("signResult", JSON.stringify({ signature: result }));
        route("/sign-success", true);
      }
    } else {
      if (isTx) {
        sessionStorage.setItem("txResult", JSON.stringify({ error: res.error }));
        route("/tx-error", true);
      } else {
        sessionStorage.setItem("signResult", JSON.stringify({ error: res.error }));
        route("/sign-error", true);
      }
    }
  }

  async function handleReject() {
    if (isDev) {
      route("/home", true);
      return;
    }
    if (data) {
      await sendMessage({ type: "REJECT_REQUEST", id: data.approval.id });
      pendingApprovalData.value = null;
    }
    await routeToNextApprovalOrClose(() => {
      if (isPopupOrigin) {
        route("/home", true);
      } else {
        closePopup();
      }
    });
  }

  if (loading) {
    return (
      <div class="flex items-center justify-center h-[600px]">
        <Spinner />
      </div>
    );
  }

  if (isDev) {
    return <DevApprove />;
  }

  if (!data) {
    return (
      <div class="flex flex-col items-center justify-center h-[600px] px-4 text-center">
        <p class="text-text-secondary text-sm">No pending request.</p>
        <Button class="mt-4" onClick={() => route("/home", true)}>
          Back to Wallet
        </Button>
      </div>
    );
  }

  const { approval, queueSize } = data;

  const title = isTx
    ? isPopupOrigin
      ? "Confirm Send"
      : approval.method === "eth_signTransaction"
        ? "Sign Transaction"
        : "Transaction Request"
    : "Signature Request";

  const network = NETWORK_BY_ID.get(approval.chainId);

  return (
    <div class="flex flex-col h-[600px]">
      <div class="text-center py-3 border-b border-divider relative">
        <h1 class="text-base font-semibold text-text-primary">{title}</h1>
        {queueSize != null && queueSize > 1 && (
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full">
            +{queueSize - 1} more
          </span>
        )}
      </div>

      <div class="flex items-center justify-between px-4 py-1.5 text-xs text-text-tertiary border-b border-divider">
        <div class="flex items-center gap-1.5">
          {network && <ChainIcon chainId={network.chain.id} size={14} />}
          <span>{network?.chain.name ?? `Chain ${approval.chainId}`}</span>
          {network?.chain.testnet && (
            <span class="text-[10px] text-warning font-medium">testnet</span>
          )}
        </div>
        <span class="inline-flex items-center gap-1">
          {data.account.name} · {truncateAddress(data.account.address)}
          <CopyButton text={data.account.address} size={12} />
        </span>
      </div>

      {!isPopupOrigin && (
        <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
          <Globe size={16} class="text-text-tertiary" />
          <span class="text-sm text-text-secondary">{approval.origin}</span>
        </div>
      )}

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
        {isTx ? (
          <TxContent
            data={data}
            gasSpeed={gasSpeed}
            setGasSpeed={setGasSpeed}
            showDetails={showDetails}
            setShowDetails={setShowDetails}
            showData={showData}
            setShowData={setShowData}
          />
        ) : (
          <SignContent data={data} />
        )}
      </div>

      {isVaultMode && (
        <div class="px-4 pt-2">
          <Input
            type="password"
            placeholder="Enter password to sign"
            value={password}
            onInput={(v) => {
              setPassword(v);
              setAuthError("");
            }}
            error={authError || undefined}
          />
        </div>
      )}

      <BottomActions>
        <Button variant="secondary" onClick={handleReject} fullWidth disabled={submitting}>
          Reject
        </Button>
        <Button onClick={handleConfirm} fullWidth loading={submitting}>
          {isVaultMode ? (
            isTx ? (
              "Confirm"
            ) : (
              "Sign"
            )
          ) : (
            <span class="inline-flex items-center gap-1.5">
              <Fingerprint size={16} />
              {isTx ? "Confirm" : "Sign"}
            </span>
          )}
        </Button>
      </BottomActions>
    </div>
  );
}
