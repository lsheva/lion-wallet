import { sendMessage } from "@shared/messages";
import { useMemo, useState } from "preact/hooks";
import { route } from "preact-router";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Input } from "../components/Input";

function getStrength(pw: string): { level: number; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: "", color: "bg-divider" };
  if (pw.length < 6) return { level: 1, label: "Too short", color: "bg-danger" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "Weak", color: "bg-danger" };
  if (score === 2) return { level: 2, label: "Fair", color: "bg-warning" };
  return { level: 3, label: "Strong", color: "bg-success" };
}

export function SetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const strength = getStrength(password);
  const match = password.length > 0 && password === confirm;
  const canContinue = match && strength.level >= 2;

  const chosePasswordOverKeychain = useMemo(
    () => sessionStorage.getItem("onboarding_vault_preferred") === "true",
    [],
  );

  const handleContinue = async () => {
    setLoading(true);
    setError("");
    const res = await sendMessage({ type: "CREATE_WALLET", password });
    setLoading(false);

    if (!res.ok) {
      setError((res as { error?: string }).error ?? "Failed to create wallet");
      return;
    }

    const data = res.data as { mnemonic: string };
    sessionStorage.setItem("onboarding_mnemonic", data.mnemonic);
    sessionStorage.setItem("onboarding_password", password);
    sessionStorage.removeItem("onboarding_vault_preferred");
    route("/seed-phrase");
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Set Password" onBack="/" />
      <div class="flex-1 px-4 pt-4">
        {chosePasswordOverKeychain && (
          <div class="mb-4">
            <Banner variant="warning">
              Touch ID protects your keys with hardware-backed security. A password is less secure —
              make it strong.
            </Banner>
          </div>
        )}

        <p class="text-sm text-text-secondary mb-6">
          Create a password to encrypt your wallet on this device.
        </p>

        <Input
          label="Password"
          type="password"
          placeholder="Enter password"
          value={password}
          onInput={setPassword}
          autoFocus
        />

        <div class="mt-4">
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Re-enter password"
            value={confirm}
            onInput={setConfirm}
            error={confirm.length > 0 && !match ? "Passwords don't match" : undefined}
          />
        </div>

        {password.length > 0 && (
          <div class="mt-3 space-y-1">
            <div class="flex gap-1 h-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  class={`flex-1 rounded-full transition-colors duration-300 ${
                    i <= strength.level ? strength.color : "bg-divider"
                  }`}
                />
              ))}
            </div>
            <p class="text-xs text-text-tertiary">{strength.label}</p>
          </div>
        )}

        {error && (
          <div class="mt-3">
            <Banner variant="danger">{error}</Banner>
          </div>
        )}
      </div>

      <div class="px-4 py-4">
        <Button disabled={!canContinue} onClick={handleContinue} loading={loading} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
