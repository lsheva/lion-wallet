import { useNavigate } from "@solidjs/router";
import { ArrowLeft } from "lucide-solid";
import { type JSX, Show } from "solid-js";

interface HeaderProps {
  title: string;
  onBack?: (() => void) | string;
  right?: JSX.Element;
}

export function Header(props: HeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof props.onBack === "string") {
      navigate(props.onBack, { replace: true });
    } else if (props.onBack) {
      props.onBack();
    } else {
      history.back();
    }
  };

  return (
    <div class="flex items-center h-12 px-4 bg-base sticky top-0 z-10">
      <div class="w-10">
        <Show when={props.onBack !== undefined}>
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            class="p-1 -ml-1 text-accent hover:text-accent-hover transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
        </Show>
      </div>
      <h1 class="flex-1 text-center text-base font-semibold text-text-primary truncate">
        {props.title}
      </h1>
      <div class="w-10 flex justify-end">{props.right}</div>
    </div>
  );
}
