/**
 * Settings entry-point for the connected-sites list.
 */
import { ChevronRight, Globe } from "lucide-solid";
import { Card } from "../../components/Card";
import { useNavigate } from "../../router";

export function Connections() {
  const navigate = useNavigate();
  return (
    <Card header="Connections" padding={false}>
      <button
        type="button"
        onClick={() => navigate("/settings/connected-sites", { replace: true })}
        class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-2">
          <Globe size={16} class="text-text-tertiary" />
          <span class="text-sm text-text-primary">Connected sites</span>
        </div>
        <ChevronRight size={16} class="text-text-tertiary" />
      </button>
    </Card>
  );
}
