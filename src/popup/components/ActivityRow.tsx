import { getActivityAddressBookCandidate } from "@shared/activity";
import {
  resolveAddressAlias,
  tokenColorFromAddress,
  truncateAddress,
  truncateWithEllipsis,
} from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { ActivityItem, AddressBookEntry, DecodedEvent, SerializedAccount } from "@shared/types";
import { FileCode, Star } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { Address } from "viem";
import { formatEther, formatUnits, getAddress } from "viem/utils";
import { Button } from "./Button";
import { ChainIcon } from "./ChainIcon";
import { FormattedTokenValue } from "./FormattedTokenValue";
import { Modal } from "./Modal";
import { TokenImage } from "./TokenImage";

interface ActivityRowProps {
  item: ActivityItem;
  userAddress: string;
  explorerUrl?: string;
  nativeSymbol: string;
  chainId: number;
  addressBook: AddressBookEntry[];
  accounts: SerializedAccount[];
  onAddressBookSaved?: () => void;
}

type RowAssetIcon = { kind: "native" } | { kind: "erc20"; address: string; symbol: string } | { kind: "contract" };

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

const TRANSFER_EVENTS = new Set(["Transfer", "Approval"]);

function nonTransferEvents(events: DecodedEvent[]): DecodedEvent[] {
  return events.filter((e) => !TRANSFER_EVENTS.has(e.name));
}

export function ActivityRow(props: ActivityRowProps) {
  const [saveModalOpen, setSaveModalOpen] = createSignal(false);
  const [saveModalName, setSaveModalName] = createSignal("");
  const [justSaved, setJustSaved] = createSignal(false);

  const isSent = props.item.from.toLowerCase() === props.userAddress.toLowerCase();
  const isContract = !!(
    props.item.decoded ||
    props.item.fn ||
    (props.item.method && props.item.method !== "0x")
  );
  const transfers = props.item.transfers ?? [];
  const otherEvents = nonTransferEvents(props.item.events ?? []);

  let label: string;
  if (isContract) {
    label = props.item.decoded?.functionName ?? (props.item.fn || "Contract Call");
  } else {
    label = isSent ? "Sent" : "Received";
  }

  const rowAssetIcon = createMemo((): RowAssetIcon => {
    const hasNative = BigInt(props.item.value || "0") !== 0n;
    const tr = props.item.transfers ?? [];
    if (hasNative) return { kind: "native" };
    const first = tr[0];
    if (first) return { kind: "erc20", address: first.token, symbol: first.symbol };
    return { kind: "contract" };
  });

  const erc20ForIcon = createMemo(() => {
    const a = rowAssetIcon();
    return a.kind === "erc20" ? a : null;
  });

  const counterparty = isSent ? props.item.to : props.item.from;

  const counterpartyAlias = createMemo(() =>
    resolveAddressAlias(counterparty, props.accounts, props.addressBook),
  );

  const counterpartyDisplay = createMemo(() => {
    const alias = counterpartyAlias();
    if (alias) return truncateWithEllipsis(alias, 15);
    return truncateAddress(counterparty);
  });

  const ethValue = formatEther(BigInt(props.item.value || "0"));
  const symbol = props.nativeSymbol;

  const hasNativeValue = BigInt(props.item.value || "0") !== 0n;
  const hasBalanceDelta = hasNativeValue || transfers.length > 0;

  const saveCandidate = createMemo(() => {
    const raw = getActivityAddressBookCandidate(props.item, props.userAddress);
    if (!raw) return undefined;
    try {
      return getAddress(raw);
    } catch {
      return undefined;
    }
  });

  const alreadyInBook = createMemo(() => {
    const c = saveCandidate();
    if (!c) return true;
    return props.addressBook.some((e) => e.address.toLowerCase() === c.toLowerCase());
  });

  const showSaveToBook = createMemo(() => saveCandidate() && !alreadyInBook() && !justSaved());

  const openExplorer = () => {
    if (props.explorerUrl && props.item.hash) {
      window.open(`${props.explorerUrl}/tx/${props.item.hash}`, "_blank", "noopener");
    }
  };

  const handleSaveToAddressBook = async () => {
    const addr = saveCandidate();
    const name = saveModalName().trim();
    if (!addr || !name) return;
    const res = await sendMessage({
      type: "UPSERT_ADDRESS_BOOK_ENTRY",
      address: addr as Address,
      name,
    });
    if (res.ok) {
      setJustSaved(true);
      setSaveModalOpen(false);
      setSaveModalName("");
      props.onAddressBookSaved?.();
    }
  };

  const rowKeyActivate = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openExplorer();
    }
  };

  return (
    <>
      <div class="flex items-start w-full px-4 py-2.5 hover:bg-base/50 transition-colors gap-3">
        {/* biome-ignore lint/a11y/useSemanticElements: inner Star button cannot nest inside <button> */}
        <div
          class="flex items-start flex-1 min-w-0 gap-3 text-left rounded-md -mx-1 px-1 py-0.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          onClick={openExplorer}
          onKeyDown={rowKeyActivate}
          role="button"
          tabIndex={0}
        >
          <div class="shrink-0 flex items-center justify-center w-8 h-8 mt-0.5">
            <Show when={rowAssetIcon().kind === "native"}>
              <ChainIcon chainId={props.chainId} size={32} />
            </Show>
            <Show when={erc20ForIcon()} keyed>
              {(t) => (
                <TokenImage
                  address={t.address}
                  chainId={props.chainId}
                  symbol={t.symbol}
                  color={tokenColorFromAddress(t.address)}
                  size={32}
                />
              )}
            </Show>
            <Show when={rowAssetIcon().kind === "contract"}>
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-accent bg-accent/10">
                <FileCode size={16} />
              </div>
            </Show>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-medium text-text-primary">{label}</span>
              <Show when={props.item.error}>
                <span class="text-[10px] font-semibold text-danger">Failed</span>
              </Show>
            </div>
            <div class="flex items-center gap-1 text-xs text-text-tertiary flex-wrap min-w-0">
              <span class="min-w-0 truncate font-mono text-text-tertiary" title={counterpartyAlias() ?? counterparty}>
                {counterpartyDisplay()}
              </span>
              <Show when={showSaveToBook()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSaveModalOpen(true);
                  }}
                  class="shrink-0 p-1 rounded text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                  title="Save to address book"
                >
                  <Star size={12} strokeWidth={2} />
                </button>
              </Show>
              <span>·</span>
              <span>{relativeTime(props.item.ts)}</span>
            </div>
            <Show when={otherEvents.length > 0}>
              <div class="flex flex-wrap gap-1 mt-0.5">
                <For each={otherEvents}>
                  {(e) => (
                    <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                      {e.name}
                    </span>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <Show when={hasBalanceDelta}>
            <div class="text-right shrink-0 flex flex-col items-end gap-0.5">
              <Show when={hasNativeValue}>
                <span
                  class={`text-[11px] font-mono inline-flex items-baseline flex-wrap justify-end gap-x-0.5 ${isSent ? "text-danger" : "text-success"}`}
                >
                  <span>{isSent ? "−" : "+"}</span>
                  <FormattedTokenValue value={ethValue} />
                  <span>{symbol}</span>
                </span>
              </Show>
              <For each={transfers}>
                {(t) => (
                  <span
                    class={`text-[11px] font-mono inline-flex items-baseline flex-wrap justify-end gap-x-0.5 ${t.dir === "in" ? "text-success" : "text-danger"}`}
                  >
                    <span>{t.dir === "in" ? "+" : "−"}</span>
                    <FormattedTokenValue value={formatUnits(BigInt(t.amount || "0"), t.decimals)} />
                    <span>{t.symbol}</span>
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      <Modal open={saveModalOpen()} onClose={() => setSaveModalOpen(false)} title="Save to Address Book">
        <div class="p-4 space-y-3">
          <div class="text-xs font-mono text-text-secondary bg-surface rounded-[var(--radius-card)] px-3 py-2">
            <Show when={saveCandidate()} keyed>
              {(addr) => addr}
            </Show>
          </div>
          <div class="space-y-1.5">
            <label for={`ab-activity-${props.item.hash}`} class="block text-sm font-medium text-text-secondary">
              Name
            </label>
            <input
              id={`ab-activity-${props.item.hash}`}
              class="w-full bg-surface rounded-[var(--radius-card)] px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none ring-1 ring-transparent focus:ring-accent/40 focus:ring-2 transition-shadow"
              type="text"
              placeholder="e.g. Alice, Exchange"
              value={saveModalName()}
              onInput={(e) => setSaveModalName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveToAddressBook();
              }}
            />
          </div>
          <Button onClick={handleSaveToAddressBook} disabled={!saveModalName().trim()} size="lg">
            Save
          </Button>
        </div>
      </Modal>
    </>
  );
}
