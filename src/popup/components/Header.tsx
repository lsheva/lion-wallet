import { ArrowLeft } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { route } from "preact-router";

interface HeaderProps {
  title: string;
  onBack?: (() => void) | string;
  right?: ComponentChildren;
}

export function Header({ title, onBack, right }: HeaderProps) {
  const handleBack = () => {
    if (typeof onBack === "string") {
      route(onBack, true);
    } else if (onBack) {
      onBack();
    } else {
      history.back();
    }
  };

  return (
    <div class="flex items-center h-12 px-4 bg-base sticky top-0 z-10">
      <div class="w-10">
        {onBack !== undefined && (
          <button
            onClick={handleBack}
            class="p-1 -ml-1 text-accent hover:text-accent-hover transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
        )}
      </div>
      <h1 class="flex-1 text-center text-base font-semibold text-text-primary truncate">{title}</h1>
      <div class="w-10 flex justify-end">{right}</div>
    </div>
  );
}
