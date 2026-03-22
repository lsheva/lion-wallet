import { truncateAddress } from "@shared/format";
import { sendMessage } from "@shared/messages";
import { Eye, EyeOff, Fingerprint } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CopyButton } from "../components/CopyButton";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { walletState } from "../store";

export function ExportPrivateKey() {
  const [password, setPassword] = createSignal("");
  const [revealed, setRevealed] = createSignal(false);
  const [showKey, setShowKey] = createSignal(false);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [privateKey, setPrivateKey] = createSignal("");
  const account = () => walletState.activeAccount();
  const isVault = () => walletState.storageMode() === "vault";

  const handleReveal = async () => {
    if (isVault() && password().length < 4) {
      setError("Incorrect password");
      return;
    }
    setError("");
    setLoading(true);

    const res = await sendMessage({
      type: "EXPORT_PRIVATE_KEY",
      accountIndex: walletState.activeAccountIndex(),
      ...(isVault() ? { password: password() } : {}),
    });

    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setPrivateKey(res.data.privateKey);
    setRevealed(true);
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Export Private Key" onBack="/settings" />

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
        <Banner variant="danger">
          Never share your private key. Anyone with this key has full control of your wallet.
        </Banner>

        <Card>
          <p class="text-xs text-text-secondary">Account</p>
          <p class="text-sm font-semibold text-text-primary mt-0.5">{account().name}</p>
          <p class="text-xs font-mono text-text-primary/70 mt-0.5">
            {truncateAddress(account().address)}
          </p>
        </Card>

        <Show
          when={revealed()}
          fallback={
            <>
              <Show when={isVault()}>
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
              </Show>
              <Show when={!isVault() && error()}>
                <Banner variant="danger">{error()}</Banner>
              </Show>
              <Button onClick={handleReveal} size="lg" loading={loading()}>
                <Show
                  when={isVault()}
                  fallback={
                    <span class="inline-flex items-center gap-1.5">
                      <Fingerprint size={16} />
                      Reveal Private Key
                    </span>
                  }
                >
                  Reveal Private Key
                </Show>
              </Button>
            </>
          }
        >
          <div class="space-y-3">
            <Card>
              <div class="flex items-center justify-between mb-2">
                <p class="text-xs text-text-secondary">Private Key</p>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey())}
                    class="p-1 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                  >
                    <Show when={showKey()} fallback={<Eye size={14} />}>
                      <EyeOff size={14} />
                    </Show>
                  </button>
                  <CopyButton text={privateKey()} size={14} />
                </div>
              </div>
              <p class="font-mono text-xs text-text-primary break-all leading-relaxed select-all">
                {showKey() ? privateKey() : "\u2022".repeat(66)}
              </p>
            </Card>
          </div>
        </Show>
      </div>
    </div>
  );
}
