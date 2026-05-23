/**
 * Settings entry-point for the saved-addresses page.
 */
import { BookUser, ChevronRight } from "lucide-solid";
import { Card } from "../../components/Card";
import { useNavigate } from "../../router";

export function AddressBook() {
  const navigate = useNavigate();
  return (
    <Card header="Address Book" padding={false}>
      <button
        type="button"
        onClick={() => navigate("/address-book", { replace: true })}
        class="flex items-center justify-between w-full px-4 py-3 hover:bg-base/50 transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-2">
          <BookUser size={16} class="text-text-tertiary" />
          <span class="text-sm text-text-primary">Saved Addresses</span>
        </div>
        <ChevronRight size={16} class="text-text-tertiary" />
      </button>
    </Card>
  );
}
