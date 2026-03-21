import { sendMessage } from "@shared/messages";
import { Fingerprint } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { route } from "preact-router";
import lionIcon from "../../icons/icon.generated.svg";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";

export function Welcome() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keychainAvailable, setKeychainAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    sendMessage({ type: "CHECK_KEYCHAIN_AVAILABLE" }).then((res) => {
      if (res.ok && res.data?.available) {
        setKeychainAvailable(true);
      } else {
        setKeychainAvailable(false);
        if (res.ok && res.data?.error) {
          setError(`Keychain probe failed: ${res.data.error}`);
        }
      }
    });
  }, []);

  const handleCreateKeychain = async () => {
    setLoading(true);
    setError("");
    const res = await sendMessage({ type: "CREATE_WALLET" });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    sessionStorage.setItem("onboarding_mnemonic", res.data.mnemonic);
    route("/seed-phrase");
  };

  const handleCreatePassword = () => {
    sessionStorage.setItem("onboarding_vault_preferred", "true");
    route("/set-password");
  };

  return (
    <div class="flex flex-col items-center justify-center h-[600px] px-4">
      <div class="relative mb-6">
        <div class="absolute inset-0 bg-accent/20 rounded-full blur-2xl scale-150" />
        <img src={lionIcon} alt="Lion Wallet" class="relative w-20 h-20 rounded-2xl shadow-lg" />
      </div>

      <h1 class="text-xl font-bold text-text-primary mb-1">Lion Wallet</h1>
      <p class="text-sm text-text-secondary mb-10">Your keys. Your crypto.</p>

      {error && (
        <div class="w-full mb-4">
          <Banner variant="danger">{error}</Banner>
        </div>
      )}

      <div class="w-full space-y-3">
        {keychainAvailable ? (
          <>
            <Button onClick={handleCreateKeychain} size="lg" loading={loading}>
              <span class="inline-flex items-center gap-1.5">
                <Fingerprint size={18} />
                Create with Touch ID
              </span>
            </Button>
            <button
              type="button"
              onClick={handleCreatePassword}
              class="w-full text-center text-xs text-text-tertiary hover:text-accent transition-colors cursor-pointer py-1"
            >
              Use password instead
            </button>
          </>
        ) : (
          <Button onClick={() => route("/set-password")} size="lg">
            Create New Wallet
          </Button>
        )}
        <Button variant="secondary" onClick={() => route("/import")} size="lg">
          Import Existing
        </Button>
      </div>
    </div>
  );
}
