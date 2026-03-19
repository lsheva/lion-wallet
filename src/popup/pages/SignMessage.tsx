import { useState, useEffect } from "preact/hooks";
import { route } from "preact-router";
import { Globe } from "lucide-preact";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { BottomActions } from "../components/BottomActions";
import { Identicon } from "../components/Identicon";
import { AddressDisplay } from "../components/AddressDisplay";
import { Spinner } from "../components/Spinner";
import { pendingApprovalData } from "../App";
import { sendMessage } from "@shared/messages";
import type { PendingApproval, SerializedAccount } from "@shared/types";
import { MOCK_SIGN_REQUEST } from "../mock/data";
import { walletState } from "../mock/state";

interface ApprovalData {
  approval: PendingApproval;
  account: SerializedAccount;
}

function decodeMessage(method: string, params: unknown[]): string {
  if (method === "personal_sign") {
    const hex = params[0] as string;
    if (hex.startsWith("0x")) {
      try {
        const bytes = [];
        for (let i = 2; i < hex.length; i += 2) {
          bytes.push(parseInt(hex.substring(i, i + 2), 16));
        }
        return new TextDecoder().decode(new Uint8Array(bytes));
      } catch {
        return hex;
      }
    }
    return hex;
  }

  if (method === "eth_sign") {
    return params[1] as string;
  }

  if (method === "eth_signTypedData_v4" || method === "eth_signTypedData") {
    try {
      const data = typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];
      return JSON.stringify(data, null, 2);
    } catch {
      return String(params[1]);
    }
  }

  return JSON.stringify(params, null, 2);
}

function getMethodLabel(method: string): string {
  switch (method) {
    case "personal_sign": return "Personal Sign";
    case "eth_sign": return "Eth Sign";
    case "eth_signTypedData_v4":
    case "eth_signTypedData": return "Typed Data";
    default: return "Sign";
  }
}

export function SignMessage() {
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (isDev) {
      setLoading(false);
      return;
    }

    const cached = pendingApprovalData.value as ApprovalData | null;
    if (cached?.approval) {
      setData(cached);
      setLoading(false);
      return;
    }

    sendMessage({ type: "GET_PENDING_APPROVAL" }).then((res) => {
      if (res.ok && res.data) {
        setData(res.data as ApprovalData);
      }
      setLoading(false);
    });
  }, []);

  async function handleSign() {
    if (isDev) {
      route("/sign-success");
      return;
    }
    if (!data) return;
    setSubmitting(true);
    const res = await sendMessage({
      type: "APPROVE_REQUEST",
      id: data.approval.id,
    });
    pendingApprovalData.value = null;
    if (res.ok) {
      const result = (res.data as Record<string, unknown>)?.result;
      sessionStorage.setItem("signResult", JSON.stringify({ signature: result }));
      route("/sign-success");
    } else {
      sessionStorage.setItem("signResult", JSON.stringify({ error: res.error }));
      route("/sign-error");
    }
  }

  async function handleReject() {
    if (isDev) {
      route("/home");
      return;
    }
    if (data) {
      await sendMessage({ type: "REJECT_REQUEST", id: data.approval.id });
      pendingApprovalData.value = null;
    }
    window.close();
  }

  if (loading) {
    return (
      <div class="flex items-center justify-center h-[600px]">
        <Spinner />
      </div>
    );
  }

  if (isDev) {
    return <DevSignMessage />;
  }

  if (!data) {
    return (
      <div class="flex flex-col items-center justify-center h-[600px] px-4 text-center">
        <p class="text-text-secondary text-sm">No pending signature request.</p>
        <Button class="mt-4" onClick={() => route("/home")}>Back to Wallet</Button>
      </div>
    );
  }

  const { approval, account } = data;
  const message = decodeMessage(approval.method, approval.params);
  const methodLabel = getMethodLabel(approval.method);
  const isTypedData = approval.method.includes("signTypedData");

  return (
    <div class="flex flex-col h-[600px]">
      <div class="text-center py-3 border-b border-divider">
        <h1 class="text-base font-semibold text-text-primary">Signature Request</h1>
      </div>

      <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
        <Globe size={16} class="text-text-tertiary" />
        <span class="text-sm text-text-secondary">{approval.origin}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full">
            {methodLabel}
          </span>
        </div>

        <p class="text-sm text-text-secondary">
          This site is requesting your signature.
          {approval.method === "eth_sign" && (
            <span class="block mt-1 text-xs text-warning font-medium">
              Warning: eth_sign can sign arbitrary hashes. Only sign if you trust this site.
            </span>
          )}
        </p>

        <Card header="Message" padding={false}>
          <div class="px-4 py-3 max-h-[200px] overflow-y-auto">
            <pre class={`font-mono text-xs text-text-primary whitespace-pre-wrap break-words leading-relaxed ${isTypedData ? "text-[10px]" : ""}`}>
              {message}
            </pre>
          </div>
        </Card>

        <Card>
          <div class="flex items-center gap-3">
            <Identicon address={account.address} size={32} />
            <div>
              <p class="text-xs text-text-secondary">Signing with</p>
              <AddressDisplay address={account.address} />
            </div>
          </div>
        </Card>
      </div>

      <BottomActions>
        <Button variant="secondary" onClick={handleReject} fullWidth disabled={submitting}>
          Reject
        </Button>
        <Button onClick={handleSign} fullWidth loading={submitting}>
          Sign
        </Button>
      </BottomActions>
    </div>
  );
}

function DevSignMessage() {
  const req = MOCK_SIGN_REQUEST;
  const account = walletState.activeAccount.value;

  return (
    <div class="flex flex-col h-[600px]">
      <div class="text-center py-3 border-b border-divider">
        <h1 class="text-base font-semibold text-text-primary">Signature Request</h1>
      </div>

      <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
        <Globe size={16} class="text-text-tertiary" />
        <span class="text-sm text-text-secondary">{req.origin}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full">
            Personal Sign
          </span>
        </div>

        <p class="text-sm text-text-secondary">
          This site is requesting your signature.
        </p>

        <Card header="Message" padding={false}>
          <div class="px-4 py-3 max-h-[200px] overflow-y-auto">
            <pre class="font-mono text-xs text-text-primary whitespace-pre-wrap break-words leading-relaxed">
              {req.message}
            </pre>
          </div>
        </Card>

        <Card>
          <div class="flex items-center gap-3">
            <Identicon address={account.address} size={32} />
            <div>
              <p class="text-xs text-text-secondary">Signing with</p>
              <AddressDisplay address={account.address} />
            </div>
          </div>
        </Card>
      </div>

      <BottomActions>
        <Button variant="secondary" onClick={() => route("/home")} fullWidth>
          Reject
        </Button>
        <Button onClick={() => route("/sign-success")} fullWidth>
          Sign
        </Button>
      </BottomActions>
    </div>
  );
}
