/**
 * "Security" card — surfaces whether the wallet is keychain-backed (Touch ID)
 * or password-encrypted vault. Read-only.
 */
import { Fingerprint, ShieldCheck } from "lucide-solid";
import { Card } from "../../components/Card";
import { walletState } from "../../store";

export function Security() {
  return (
    <Card header="Security" padding={false}>
      <div class="divide-y divide-divider">
        <div class="flex items-center gap-2 px-4 py-3">
          {walletState.storageMode() === "keychain" ? (
            <>
              <Fingerprint size={16} class="text-accent" />
              <span class="text-sm text-text-primary">Secured by Touch ID</span>
            </>
          ) : (
            <>
              <ShieldCheck size={16} class="text-accent" />
              <span class="text-sm text-text-primary">Secured by password</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
