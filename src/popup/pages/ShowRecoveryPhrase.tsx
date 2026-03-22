import { sendMessage } from "@shared/messages";
import { Eye, EyeOff, Fingerprint } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { walletState } from "../store";

export function ShowRecoveryPhrase() {
  const [password, setPassword] = createSignal("");
  const [revealed, setRevealed] = createSignal(false);
  const [blurred, setBlurred] = createSignal(true);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [words, setWords] = createSignal<string[]>([]);
  const isVault = () => walletState.storageMode() === "vault";

  const handleReveal = async () => {
    if (isVault() && password().length < 4) {
      setError("Incorrect password");
      return;
    }
    setError("");
    setLoading(true);

    const res = await sendMessage({
      type: "EXPORT_MNEMONIC",
      ...(isVault() ? { password: password() } : {}),
    });

    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setWords(res.data.mnemonic.split(" "));
    setRevealed(true);
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Recovery Phrase" onBack="/settings" />

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
        <Banner variant="danger">
          Never share your recovery phrase. Anyone with these words can steal your funds.
        </Banner>

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
                      Reveal Recovery Phrase
                    </span>
                  }
                >
                  Reveal Recovery Phrase
                </Show>
              </Button>
            </>
          }
        >
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setBlurred(!blurred())}
                class="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
              >
                {blurred() ? <Eye size={14} /> : <EyeOff size={14} />}
                {blurred() ? "Show words" : "Hide words"}
              </button>
              <CopyButton text={words().join(" ")} size={14} />
            </div>

            <div
              class={`grid grid-cols-3 gap-2 transition-all duration-200 ${blurred() ? "blur-md select-none" : ""}`}
            >
              <For each={words()}>
                {(word, i) => (
                  <div class="flex items-center gap-1.5 bg-surface rounded-[var(--radius-chip)] px-2.5 py-2 shadow-sm">
                    <span class="text-xs text-text-tertiary w-4 text-right">{i() + 1}</span>
                    <span class="font-mono text-sm text-text-primary">{word}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
