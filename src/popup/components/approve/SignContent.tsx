import type { ApprovalData } from "@shared/types";
import { Show } from "solid-js";
import { AddressDisplay } from "../AddressDisplay";
import { Card } from "../Card";
import { Identicon } from "../Identicon";
import { decodeMessage, getMethodLabel } from "./helpers";

export function SignContent(props: { data: ApprovalData }) {
  const approval = () => props.data.approval;
  const account = () => props.data.account;
  const message = decodeMessage(approval().method, approval().params);
  const methodLabel = getMethodLabel(approval().method);
  const isTypedData = approval().method.includes("signTypedData");

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-accent bg-accent-light px-2 py-0.5 rounded-full">
          {methodLabel}
        </span>
      </div>

      <p class="text-sm text-text-secondary">
        This site is requesting your signature.
        <Show when={approval().method === "eth_sign"}>
          <span class="block mt-1 text-xs text-warning font-medium">
            Warning: eth_sign can sign arbitrary hashes. Only sign if you trust this site.
          </span>
        </Show>
      </p>

      <Card header="Message" padding={false}>
        <div class="px-4 py-3 max-h-[200px] overflow-y-auto">
          <pre
            class={`font-mono text-xs text-text-primary whitespace-pre-wrap break-words leading-relaxed ${isTypedData ? "text-[10px]" : ""}`}
          >
            {message}
          </pre>
        </div>
      </Card>

      <Card>
        <div class="flex items-center gap-3">
          <Identicon address={account().address} size={32} />
          <div>
            <p class="text-xs text-text-secondary">Signing with</p>
            <AddressDisplay address={account().address} />
          </div>
        </div>
      </Card>
    </div>
  );
}
