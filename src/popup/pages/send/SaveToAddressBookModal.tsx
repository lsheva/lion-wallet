/**
 * Modal that lets the user assign a name to a previously seen address and
 * persist it to the address book.
 */
import { Show } from "solid-js";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";

export function SaveToAddressBookModal(props: {
  address: string | null;
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal open={props.address !== null} onClose={props.onClose} title="Save to Address Book">
      <div class="p-4 space-y-3">
        <Show when={props.address}>
          <div class="text-xs font-mono text-text-secondary bg-surface rounded-[var(--radius-card)] px-3 py-2">
            {props.address}
          </div>
        </Show>
        <div class="space-y-1.5">
          <label for="save-addr-name" class="block text-sm font-medium text-text-secondary">
            Name
          </label>
          <input
            id="save-addr-name"
            class="w-full bg-surface rounded-[var(--radius-card)] px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none ring-1 ring-transparent focus:ring-accent/40 focus:ring-2 transition-shadow"
            type="text"
            placeholder="e.g. Alice, Uniswap Router"
            value={props.name}
            onInput={(e) => props.onNameChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onSave();
            }}
            autofocus
          />
        </div>
        <Button onClick={props.onSave} disabled={!props.name.trim()} size="lg">
          Save
        </Button>
      </div>
    </Modal>
  );
}
