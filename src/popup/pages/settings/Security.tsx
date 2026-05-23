/**
 * "Security" card — shows storage mode and provides access to private key
 * export and recovery-phrase reveal.
 */
import { ChevronRight, Eye, Fingerprint, Key, ShieldCheck } from "lucide-solid";
import { Card } from "../../components/Card";
import { useNavigate } from "../../router";
import { walletState } from "../../store";

export function Security() {
  const navigate = useNavigate();

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
        <button
          type="button"
          onClick={() => navigate("/export-key", { replace: true })}
          class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2">
            <Key size={16} class="text-text-tertiary" />
            <span class="text-sm text-text-primary">Export Private Key</span>
          </div>
          <ChevronRight size={16} class="text-text-tertiary" />
        </button>
        <button
          type="button"
          onClick={() => navigate("/show-phrase", { replace: true })}
          class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2">
            <Eye size={16} class="text-text-tertiary" />
            <span class="text-sm text-text-primary">Show Recovery Phrase</span>
          </div>
          <ChevronRight size={16} class="text-text-tertiary" />
        </button>
      </div>
    </Card>
  );
}
