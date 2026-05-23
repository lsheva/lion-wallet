/**
 * Two-step "reset wallet" modal: warning → password (vault mode only) +
 * type-RESET confirmation. Calls `RESET_WALLET` on the background, wipes
 * popup-side caches/theme, and routes back to onboarding.
 */
import { toErrorMessage } from "@shared/format";
import { sendMessage } from "@shared/messages";
import { AlertTriangle, Fingerprint, Trash2 } from "lucide-solid";
import { createSignal } from "solid-js";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { useNavigate } from "../../router";
import { clearPopupCache, walletState } from "../../store";
import { showError } from "../../toast";

export function ResetWalletRow() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = createSignal(false);
  const [step, setStep] = createSignal<1 | 2>(1);
  const [password, setPassword] = createSignal("");
  const [confirmText, setConfirmText] = createSignal("");
  const [error, setError] = createSignal("");
  const [resetting, setResetting] = createSignal(false);

  const close = () => {
    setShowModal(false);
    setStep(1);
    setPassword("");
    setConfirmText("");
    setError("");
  };

  const handleReset = async () => {
    const isVault = walletState.storageMode() === "vault";
    if (isVault && password().length < 4) {
      setError("Enter your password");
      return;
    }
    setError("");
    setResetting(true);
    try {
      const res = await sendMessage({
        type: "RESET_WALLET",
        ...(isVault ? { password: password() } : {}),
      });
      if (!res.ok) {
        setError(res.error);
        showError("Could not reset wallet", res.error);
        setResetting(false);
        return;
      }
      clearPopupCache();
      localStorage.removeItem("lion-theme");
      document.documentElement.removeAttribute("data-theme");
      navigate("/", { replace: true });
    } catch (e) {
      showError("Could not reset wallet", toErrorMessage(e));
      setResetting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        class="flex items-center justify-center gap-2 w-full py-3 text-danger hover:text-danger-hover transition-colors cursor-pointer"
      >
        <Trash2 size={16} />
        <span class="text-sm font-medium">Reset Wallet</span>
      </button>

      <Modal open={showModal()} onClose={close} title="Reset Wallet">
        {step() === 1 ? (
          <div class="p-4 space-y-4">
            <div class="flex items-start gap-3 p-3 rounded-xl bg-danger/10">
              <AlertTriangle size={20} class="text-danger shrink-0 mt-0.5" />
              <p class="text-sm text-text-primary leading-relaxed">
                This will permanently delete your recovery phrase, all accounts, and all settings
                from this device. If you haven't backed up your recovery phrase, your funds will be
                lost forever.
              </p>
            </div>
            <div class="flex gap-2">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div class="p-4 space-y-4">
            {walletState.storageMode() === "vault" && (
              <Input
                label="Enter password to continue"
                type="password"
                placeholder="Password"
                value={password()}
                onInput={(v) => {
                  setPassword(v);
                  setError("");
                }}
                error={error() || undefined}
                autoFocus
              />
            )}
            {walletState.storageMode() !== "vault" && error() && (
              <div class="flex items-start gap-3 p-3 rounded-xl bg-danger/10">
                <AlertTriangle size={16} class="text-danger shrink-0 mt-0.5" />
                <p class="text-sm text-danger">{error()}</p>
              </div>
            )}
            <div>
              <p class="text-sm text-text-secondary mb-2">
                Type <span class="font-semibold text-text-primary">RESET</span> to confirm.
              </p>
              <Input
                placeholder="Type RESET"
                value={confirmText()}
                onInput={setConfirmText}
                autoFocus={walletState.storageMode() !== "vault"}
              />
            </div>
            <div class="flex gap-2">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={confirmText() !== "RESET"}
                loading={resetting()}
                onClick={handleReset}
              >
                {walletState.storageMode() === "vault" ? (
                  "Reset Wallet"
                ) : (
                  <span class="inline-flex items-center gap-1.5">
                    <Fingerprint size={16} />
                    Reset Wallet
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
