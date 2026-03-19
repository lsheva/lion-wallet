import { useState } from "preact/hooks";
import { Header } from "../components/Header";
import { Check } from "lucide-preact";

const OPTIONS = [
  { label: "1 minute", value: 1 },
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "Never", value: 0 },
];

export function AutoLockTimer() {
  const [selected, setSelected] = useState(5);

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Auto-lock Timer" onBack="/settings" />

      <div class="flex-1 overflow-y-auto px-4 pt-2">
        <p class="text-sm text-text-secondary mb-4">
          Automatically lock your wallet after a period of inactivity.
        </p>

        <div class="bg-surface rounded-[var(--radius-card)] shadow-sm divide-y divide-divider">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer text-left"
            >
              <span class="text-sm text-text-primary">{opt.label}</span>
              {selected === opt.value && <Check size={16} class="text-accent shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
