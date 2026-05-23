/**
 * Theme picker (system / light / dark) — persisted to `localStorage` and
 * applied via the `data-theme` attribute on `<html>`.
 */
import { Moon, Sun } from "lucide-solid";
import { createSignal, For } from "solid-js";
import { Card } from "../../components/Card";

export type ThemePref = "system" | "light" | "dark";

export function getThemePref(): ThemePref {
  const stored = localStorage.getItem("lion-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

export function applyTheme(pref: ThemePref) {
  localStorage.setItem("lion-theme", pref);
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", pref);
  }
}

export function ThemeSelector() {
  const [theme, setTheme] = createSignal<ThemePref>(getThemePref());

  const options: Array<{ value: ThemePref; label: string; Icon: typeof Sun }> = [
    { value: "system", label: "System", Icon: Sun },
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
  ];

  return (
    <Card header="Appearance" padding={false}>
      <div class="flex px-4 py-3 gap-2">
        <For each={options}>
          {({ value, label }) => (
            <button
              type="button"
              onClick={() => {
                setTheme(value);
                applyTheme(value);
              }}
              class={`flex-1 py-1.5 text-xs font-medium rounded-[var(--radius-chip)] transition-colors cursor-pointer ${
                theme() === value
                  ? "bg-accent text-accent-foreground"
                  : "bg-base text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          )}
        </For>
      </div>
    </Card>
  );
}
