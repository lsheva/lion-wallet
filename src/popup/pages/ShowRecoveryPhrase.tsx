import { useState } from "preact/hooks";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { CopyButton } from "../components/CopyButton";
import { Eye, EyeOff } from "lucide-preact";
import { MOCK_SEED_PHRASE } from "../mock/data";

export function ShowRecoveryPhrase() {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [blurred, setBlurred] = useState(true);
  const [error, setError] = useState("");

  const handleReveal = () => {
    if (password.length < 4) {
      setError("Incorrect password");
      return;
    }
    setError("");
    setRevealed(true);
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Recovery Phrase" onBack="/settings" />

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
        <Banner variant="danger">
          Never share your recovery phrase. Anyone with these words can steal your funds.
        </Banner>

        {!revealed ? (
          <>
            <Input
              label="Enter password to continue"
              type="password"
              placeholder="Password"
              value={password}
              onInput={(v) => { setPassword(v); setError(""); }}
              error={error}
              autoFocus
            />
            <Button onClick={handleReveal} size="lg">
              Reveal Recovery Phrase
            </Button>
          </>
        ) : (
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <button
                onClick={() => setBlurred(!blurred)}
                class="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
              >
                {blurred ? <Eye size={14} /> : <EyeOff size={14} />}
                {blurred ? "Show words" : "Hide words"}
              </button>
              <CopyButton text={MOCK_SEED_PHRASE.join(" ")} size={14} />
            </div>

            <div class={`grid grid-cols-3 gap-2 transition-all duration-200 ${blurred ? "blur-md select-none" : ""}`}>
              {MOCK_SEED_PHRASE.map((word, i) => (
                <div
                  key={i}
                  class="flex items-center gap-1.5 bg-surface rounded-[var(--radius-chip)] px-2.5 py-2 shadow-sm"
                >
                  <span class="text-xs text-text-tertiary w-4 text-right">{i + 1}</span>
                  <span class="font-mono text-sm text-text-primary">{word}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
