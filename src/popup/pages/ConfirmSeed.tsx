import { useNavigate } from "@solidjs/router";
import { createMemo, createSignal, For, Index } from "solid-js";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { refreshAll } from "../store";

export function ConfirmSeed() {
  const navigate = useNavigate();
  const [selected, setSelected] = createSignal<string[]>([]);
  const [error, setError] = createSignal(false);

  const seedWords = createMemo(() => {
    const mnemonic = sessionStorage.getItem("onboarding_mnemonic") ?? "";
    return mnemonic.split(" ").filter(Boolean);
  });

  const shuffled = createMemo(() => {
    return [...seedWords()].sort(() => Math.random() - 0.5);
  });

  if (seedWords().length === 0) {
    navigate("/", { replace: true });
    return null;
  }

  const uniqueRemaining = createMemo(() => {
    const selectedCounts: Record<string, number> = {};
    for (const s of selected()) selectedCounts[s] = (selectedCounts[s] || 0) + 1;

    const shuffledCounts: Record<string, number> = {};
    for (const s of shuffled()) shuffledCounts[s] = (shuffledCounts[s] || 0) + 1;

    const remaining = shuffled().filter((w) => (selectedCounts[w] || 0) < (shuffledCounts[w] || 0));

    if (new Set(remaining).size === remaining.length) return remaining;

    return remaining.filter((w, i, arr) => {
      const priorSelected = selectedCounts[w] || 0;
      const priorInRemaining = arr.slice(0, i).filter((s) => s === w).length;
      return priorSelected + priorInRemaining < (shuffledCounts[w] || 0);
    });
  });

  const handleSelect = (word: string) => {
    setError(false);
    const next = [...selected(), word];
    setSelected(next);

    if (next.length === seedWords().length) {
      const correct = next.every((w, i) => w === seedWords()[i]);
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

  const isComplete = () => selected().length === seedWords().length;
  const isCorrect = () => isComplete() && selected().every((w, i) => w === seedWords()[i]);

  const handleFinish = async () => {
    sessionStorage.removeItem("onboarding_mnemonic");
    sessionStorage.removeItem("onboarding_password");
    await refreshAll();
    navigate("/api-key-setup");
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Confirm Phrase" onBack="/seed-phrase" />

      <div class="flex-1 px-4 pt-2 space-y-4 overflow-y-auto">
        <p class="text-sm text-text-secondary">
          Tap the words in the correct order to verify your backup.
        </p>

        <div
          class={`grid grid-cols-4 gap-1.5 min-h-[80px] p-2 bg-surface rounded-[var(--radius-card)] ${error() ? "animate-shake" : ""}`}
        >
          <Index each={Array.from({ length: seedWords().length })}>
            {(_, i) => (
              <button
                type="button"
                onClick={() => selected()[i] && handleRemove(i)}
                class={`
                h-8 rounded-[var(--radius-chip)] text-xs font-mono flex items-center justify-center
                transition-all duration-150
                ${
                  selected()[i]
                    ? "bg-accent-light text-accent cursor-pointer hover:bg-accent/20"
                    : "bg-base text-text-tertiary"
                }
                ${error() && selected()[i] ? "bg-danger-bg text-danger" : ""}
              `}
              >
                {selected()[i] ? (
                  <span>{selected()[i]}</span>
                ) : (
                  <span class="text-text-tertiary">{i + 1}</span>
                )}
              </button>
            )}
          </Index>
        </div>

        <div class="grid grid-cols-4 gap-1.5">
          <For each={uniqueRemaining()}>
            {(word) => (
              <button
                type="button"
                onClick={() => handleSelect(word)}
                class="h-8 bg-surface rounded-[var(--radius-chip)] text-xs font-mono text-text-primary
                     hover:bg-accent-light hover:text-accent shadow-sm
                     transition-all duration-150 cursor-pointer active:scale-95"
              >
                {word}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="px-4 py-4">
        <Button disabled={!isCorrect()} onClick={handleFinish} size="lg">
          {isCorrect() ? "Wallet Created!" : "Verify & Finish"}
        </Button>
      </div>
    </div>
  );
}
