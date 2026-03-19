import { route } from "preact-router";
import { Globe } from "lucide-preact";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { BottomActions } from "../components/BottomActions";
import { Identicon } from "../components/Identicon";
import { AddressDisplay } from "../components/AddressDisplay";
import { MOCK_SIGN_REQUEST } from "../mock/data";
import { walletState } from "../mock/state";

export function SignMessage() {
  const req = MOCK_SIGN_REQUEST;
  const account = walletState.activeAccount.value;

  return (
    <div class="flex flex-col h-[600px]">
      {/* Title bar */}
      <div class="text-center py-3 border-b border-divider">
        <h1 class="text-base font-semibold text-text-primary">Signature Request</h1>
      </div>

      {/* Origin */}
      <div class="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-divider">
        <Globe size={16} class="text-text-tertiary" />
        <span class="text-sm text-text-secondary">{req.origin}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
        <p class="text-sm text-text-secondary">
          This site is requesting your signature.
        </p>

        {/* Message */}
        <Card header="Message" padding={false}>
          <div class="px-4 py-3 max-h-[200px] overflow-y-auto">
            <pre class="font-mono text-xs text-text-primary whitespace-pre-wrap break-words leading-relaxed">
              {req.message}
            </pre>
          </div>
        </Card>

        {/* Signing account */}
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
