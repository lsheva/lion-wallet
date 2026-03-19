import { useState } from "preact/hooks";
import { route } from "preact-router";
import { Header } from "../components/Header";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { MOCK_SEED_PHRASE } from "../mock/data";

export function SeedPhrase() {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Recovery Phrase" onBack="/set-password" />

      <div class="flex-1 px-4 pt-2 space-y-4 overflow-y-auto">
        <Banner variant="warning">
          Write down these 12 words in order and store them safely. Never share them with anyone.
        </Banner>

        <div class="grid grid-cols-3 gap-2">
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

        <div class="flex justify-center">
          <button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-accent transition-colors cursor-pointer">
            <CopyButton text={MOCK_SEED_PHRASE.join(" ")} size={14} />
            <span>Copy to clipboard</span>
          </button>
        </div>

        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed((e.target as HTMLInputElement).checked)}
            class="w-4 h-4 rounded accent-accent"
          />
          <span class="text-sm text-text-secondary">I saved my recovery phrase</span>
        </label>
      </div>

      <div class="px-4 py-4">
        <Button
          disabled={!confirmed}
          onClick={() => route("/confirm-seed")}
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
