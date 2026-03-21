import { useMemo, useState } from "preact/hooks";
import { route } from "preact-router";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { refreshAll } from "../store";

export function ConfirmSeed() {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState(false);

  const seedWords = useMemo(() => {
    const mnemonic = sessionStorage.getItem("onboarding_mnemonic") ?? "";
    return mnemonic.split(" ").filter(Boolean);
  }, []);

  const shuffled = useMemo(() => {
    return [...seedWords].sort(() => Math.random() - 0.5);
  }, [seedWords]);

  if (seedWords.length === 0) {
    route("/");
    return null;
  }

  const uniqueRemaining = useMemo(() => {
    const selectedCounts: Record<string, number> = {};
    for (const s of selected) selectedCounts[s] = (selectedCounts[s] || 0) + 1;

    const shuffledCounts: Record<string, number> = {};
    for (const s of shuffled) shuffledCounts[s] = (shuffledCounts[s] || 0) + 1;

    const remaining = shuffled.filter(
      (w) => (selectedCounts[w] || 0) < (shuffledCounts[w] || 0),
    );

    if (new Set(remaining).size === remaining.length) return remaining;

    return remaining.filter((w, i, arr) => {
      const priorSelected = selectedCounts[w] || 0;
      const priorInRemaining = arr.slice(0, i).filter((s) => s === w).length;
      return priorSelected + priorInRemaining < (shuffledCounts[w] || 0);
    });
  }, [selected, shuffled]);

  const handleSelect = (word: string) => {
    setError(false);
    const next = [...selected, word];
    setSelected(next);

    if (next.length === seedWords.length) {
      const correct = next.every((w, i) => w === seedWords[i]);
      if (!correct) {
        setError(true);
        setTimeout(() => {
          setSelected([]);
          setError(false);
        }, 800);
      }
    }
  };

  const handleRemove = (index: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== index));
    setError(false);
  };

  const isComplete = selected.length === seedWords.length;
  const isCorrect = isComplete && selected.every((w, i) => w === seedWords[i]);

  const handleFinish = async () => {
    sessionStorage.removeItem("onboarding_mnemonic");
    sessionStorage.removeItem("onboarding_password");
    await refreshAll();
    route("/api-key-setup");
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Confirm Phrase" onBack="/seed-phrase" />

      <div class="flex-1 px-4 pt-2 space-y-4 overflow-y-auto">
        <p class="text-sm text-text-secondary">
          Tap the words in the correct order to verify your backup.
        </p>

        <div
          class={`grid grid-cols-4 gap-1.5 min-h-[80px] p-2 bg-surface rounded-[var(--radius-card)] ${error ? "animate-shake" : ""}`}
        >
          {Array.from({ length: seedWords.length }).map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => selected[i] && handleRemove(i)}
              class={`
                h-8 rounded-[var(--radius-chip)] text-xs font-mono flex items-center justify-center
                transition-all duration-150
                ${
                  selected[i]
                    ? "bg-accent-light text-accent cursor-pointer hover:bg-accent/20"
                    : "bg-base text-text-tertiary"
                }
                ${error && selected[i] ? "bg-danger-bg text-danger" : ""}
              `}
            >
              {selected[i] ? (
                <span>{selected[i]}</span>
              ) : (
                <span class="text-text-tertiary">{i + 1}</span>
              )}
            </button>
          ))}
        </div>

        <div class="grid grid-cols-4 gap-1.5">
          {uniqueRemaining.map((word, i) => (
            <button
              type="button"
              key={`${word}-${i}`}
              onClick={() => handleSelect(word)}
              class="h-8 bg-surface rounded-[var(--radius-chip)] text-xs font-mono text-text-primary
                     hover:bg-accent-light hover:text-accent shadow-sm
                     transition-all duration-150 cursor-pointer active:scale-95"
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      <div class="px-4 py-4">
        <Button disabled={!isCorrect} onClick={handleFinish} size="lg">
          {isCorrect ? "Wallet Created!" : "Verify & Finish"}
        </Button>
      </div>
    </div>
  );
}
