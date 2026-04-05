import { isAddress, truncateAddress } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { AddressBookEntry } from "@shared/types";
import { Pencil, Plus, Star, Trash2 } from "lucide-solid";
import { createSignal, For, onMount, Show } from "solid-js";
import type { Address } from "viem";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CopyButton } from "../components/CopyButton";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";

export function AddressBook() {
  const [entries, setEntries] = createSignal<AddressBookEntry[]>([]);
  const [showModal, setShowModal] = createSignal(false);
  const [editAddr, setEditAddr] = createSignal("");
  const [editName, setEditName] = createSignal("");
  const [editExisting, setEditExisting] = createSignal(false);
  const [error, setError] = createSignal("");

  const fetchEntries = () => {
    sendMessage({ type: "GET_ADDRESS_BOOK" }).then((res) => {
      if (res.ok && res.data) setEntries(res.data.entries);
    });
  };

  onMount(fetchEntries);

  const openAdd = () => {
    setEditAddr("");
    setEditName("");
    setEditExisting(false);
    setError("");
    setShowModal(true);
  };

  const openEdit = (entry: AddressBookEntry) => {
    setEditAddr(entry.address);
    setEditName(entry.name);
    setEditExisting(true);
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    const addr = editAddr().trim();
    const name = editName().trim();
    if (!isAddress(addr)) {
      setError("Invalid address");
      return;
    }
    if (!name) {
      setError("Name is required");
      return;
    }
    const res = await sendMessage({
      type: "UPSERT_ADDRESS_BOOK_ENTRY",
      address: addr as Address,
      name,
    });
    if (res.ok) {
      setShowModal(false);
      fetchEntries();
    }
  };

  const handleRemove = async (address: string) => {
    const res = await sendMessage({
      type: "REMOVE_ADDRESS_BOOK_ENTRY",
      address: address as Address,
    });
    if (res.ok) fetchEntries();
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Address Book" onBack="/settings" />

      <div class="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-4">
        <Show
          when={entries().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center py-12 text-center">
              <Star size={32} class="text-text-tertiary mb-3" />
              <p class="text-sm text-text-secondary">No saved addresses yet</p>
              <p class="text-xs text-text-tertiary mt-1">Add addresses you send to frequently</p>
            </div>
          }
        >
          <Card padding={false}>
            <div class="divide-y divide-divider">
              <For each={entries()}>
                {(entry) => (
                  <div class="flex items-center gap-3 px-4 py-3">
                    <Star size={16} class="text-accent shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-text-primary truncate">{entry.name}</p>
                      <div class="flex items-center gap-1 mt-0.5">
                        <span class="text-xs font-mono text-text-tertiary">
                          {truncateAddress(entry.address)}
                        </span>
                        <CopyButton text={entry.address} size={12} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(entry)}
                      class="p-1.5 text-text-tertiary hover:text-accent transition-colors cursor-pointer shrink-0"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(entry.address)}
                      class="p-1.5 text-text-tertiary hover:text-danger transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Card>
        </Show>

        <button
          type="button"
          onClick={openAdd}
          class="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Address
        </button>
      </div>

      <Modal
        open={showModal()}
        onClose={() => setShowModal(false)}
        title={editExisting() ? "Edit Address" : "Add Address"}
      >
        <div class="p-4 space-y-3">
          <Show when={!editExisting()}>
            <div class="space-y-1.5">
              <label for="ab-edit-addr" class="block text-sm font-medium text-text-secondary">
                Address
              </label>
              <input
                id="ab-edit-addr"
                class={`w-full bg-surface rounded-[var(--radius-card)] px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-tertiary outline-none ring-1 transition-shadow ${
                  editAddr().length > 0 && !isAddress(editAddr())
                    ? "ring-danger"
                    : "ring-transparent focus:ring-accent/40 focus:ring-2"
                }`}
                type="text"
                placeholder="0x..."
                value={editAddr()}
                onInput={(e) => {
                  setEditAddr(e.currentTarget.value);
                  setError("");
                }}
                autofocus
              />
            </div>
          </Show>
          <Show when={editExisting()}>
            <div class="text-xs font-mono text-text-secondary bg-surface rounded-[var(--radius-card)] px-3 py-2">
              {editAddr()}
            </div>
          </Show>
          <div class="space-y-1.5">
            <label for="ab-edit-name" class="block text-sm font-medium text-text-secondary">
              Name
            </label>
            <input
              id="ab-edit-name"
              class="w-full bg-surface rounded-[var(--radius-card)] px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none ring-1 ring-transparent focus:ring-accent/40 focus:ring-2 transition-shadow"
              type="text"
              placeholder="e.g. Alice, Uniswap Router"
              value={editName()}
              onInput={(e) => {
                setEditName(e.currentTarget.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              autofocus={editExisting()}
            />
          </div>
          <Show when={error()}>
            <p class="text-xs text-danger">{error()}</p>
          </Show>
          <Button onClick={handleSave} disabled={!editName().trim()} size="lg">
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}
