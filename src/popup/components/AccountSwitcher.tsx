import { truncateAddress } from "@shared/format";
import { IMPORTED_KEYRING_ID } from "@shared/keyring-constants";
import { Check, ChevronDown, ChevronRight, LoaderCircle } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { keyringDotClass } from "../keyring-ui";
import { fetchActivity, walletState } from "../store";
import { AddressDisplay } from "./AddressDisplay";
import { Identicon } from "./Identicon";
import { BalanceSkeleton } from "./Skeleton";

const EXPANDED_STORAGE_KEY = "lion-account-switcher-expanded-wallets";

function loadExpandedWalletIds(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    const ids = arr.filter((x): x is string => typeof x === "string");
    /** Only one wallet section open at a time; migrate legacy multi-entry storage. */
    if (ids.length === 0) return new Set();
    if (ids.length === 1) return new Set(ids);
    const first = ids[0];
    return first !== undefined ? new Set([first]) : new Set();
  } catch {
    return new Set();
  }
}

function persistExpandedWalletIds(ids: Set<string>): void {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* quota / private mode */
  }
}

interface AccountSwitcherProps {
  usdTotal: string;
  loading?: boolean;
}

export function AccountSwitcher(props: AccountSwitcherProps) {
  const [open, setOpen] = createSignal(false);
  const [expandedWalletIds, setExpandedWalletIds] = createSignal<Set<string>>(
    loadExpandedWalletIds(),
  );
  let rootRef: HTMLDivElement | undefined;

  const rows = () => walletState.homeAccountsForSwitcher();
  const active = () => walletState.activeAccount();
  const activeIndex = () => walletState.activeAccountIndex();
  const multi = () => rows().length > 1;

  const hdKeyrings = createMemo(() => walletState.keyrings().filter((k) => k.type === "hd"));

  const importedRows = createMemo(() => rows().filter((r) => r.account.path === "imported"));

  const accountsForKeyring = (keyringId: string) =>
    rows().filter((r) => r.account.path !== "imported" && r.account.keyringId === keyringId);

  const toggleWalletExpanded = (id: string) => {
    setExpandedWalletIds((prev) => {
      let next: Set<string>;
      if (prev.has(id)) {
        next = new Set();
      } else {
        next = new Set([id]);
      }
      persistExpandedWalletIds(next);
      return next;
    });
  };

  const isWalletExpanded = (id: string) => expandedWalletIds().has(id);

  const activeKeyringLabel = createMemo(() => {
    const a = active();
    return walletState.keyrings().find((k) => k.id === a.keyringId)?.label ?? "";
  });

  createEffect(
    on(open, (isOpen) => {
      if (!isOpen) return;
      const onDoc = (e: MouseEvent) => {
        if (rootRef && !rootRef.contains(e.target as Node)) setOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
      onCleanup(() => {
        document.removeEventListener("mousedown", onDoc);
        document.removeEventListener("keydown", onKey);
      });
    }),
  );

  const selectAccount = async (accountArrayIndex: number) => {
    setOpen(false);
    if (accountArrayIndex === activeIndex()) return;
    await walletState.switchAccount(accountArrayIndex);
    fetchActivity().catch(() => {});
  };

  const toggle = () => {
    if (multi()) setOpen((o) => !o);
  };

  const onCardKeyDown = (e: KeyboardEvent) => {
    if (!multi()) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div
      ref={rootRef}
      class={`relative rounded-2xl border shadow-sm transition-[background-color,border-color,box-shadow,transform] ${
        multi()
          ? `cursor-pointer select-none active:scale-[0.995] outline-none focus:outline-none focus-visible:outline-none ${
              open()
                ? "z-50 bg-divider/15 border-accent/35 shadow-md"
                : "z-auto border-divider/60 bg-surface hover:bg-divider/20 hover:border-divider hover:shadow-md"
            }`
          : "z-auto border-divider/60 bg-surface shadow-sm"
      }`}
      {...(multi()
        ? {
            role: "button" as const,
            tabIndex: 0,
            "aria-expanded": open(),
            "aria-haspopup": "listbox",
            "aria-label": "Switch wallet — tap to choose account",
            title: "Switch wallet",
            onClick: toggle,
            onKeyDown: onCardKeyDown,
          }
        : {})}
    >
      <div class="flex items-center gap-3 min-h-[52px] px-4 py-3">
        <div class="shrink-0 rounded-full ring-2 ring-divider/80 overflow-hidden shadow-inner">
          <Identicon address={active().address} size={52} />
        </div>

        <div class="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div class="flex items-baseline justify-between gap-3">
            <span class="flex min-w-0 flex-col gap-0">
              <span class="flex min-w-0 items-center gap-1">
                <span class="truncate text-base font-semibold text-text-primary leading-tight">
                  {active().name}
                </span>
                <Show when={props.loading}>
                  <LoaderCircle size={14} class="shrink-0 animate-spin text-text-tertiary" />
                </Show>
                <Show when={multi()}>
                  <ChevronDown
                    size={16}
                    class={`shrink-0 text-text-tertiary transition-transform ${open() ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </Show>
              </span>
              <Show when={activeKeyringLabel()}>
                <span class="text-[11px] text-text-tertiary font-normal truncate leading-tight">
                  {activeKeyringLabel()}
                </span>
              </Show>
            </span>
            <Show when={!props.loading || props.usdTotal !== "—"} fallback={<BalanceSkeleton />}>
              <span class="shrink-0 text-lg font-semibold text-text-primary tabular-nums tracking-tight leading-none">
                {props.usdTotal}
              </span>
            </Show>
          </div>
          <AddressDisplay address={active().address} class="justify-start" />
        </div>
      </div>

      <Show when={open() && multi()}>
        <div
          class="absolute left-3 right-3 top-full z-[60] mt-0.5 rounded-xl border border-divider bg-surface shadow-lg max-h-[min(360px,70vh)] overflow-y-auto"
          role="listbox"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div class="divide-y divide-divider">
            <For each={hdKeyrings()}>
              {(kr) => (
                <div class="border-b border-divider last:border-b-0">
                  <button
                    type="button"
                    class="group flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-base/50 transition-colors cursor-pointer"
                    onClick={() => toggleWalletExpanded(kr.id)}
                  >
                    <span class="shrink-0 p-0.5 text-text-tertiary group-hover:text-text-secondary">
                      <ChevronRight
                        size={16}
                        class={`transition-transform ${isWalletExpanded(kr.id) ? "rotate-90" : ""}`}
                      />
                    </span>
                    <span class={`w-2.5 h-2.5 rounded-full shrink-0 ${keyringDotClass(kr.id)}`} />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-text-primary truncate">{kr.label}</p>
                      <p class="text-[11px] text-text-tertiary">
                        {accountsForKeyring(kr.id).length} account
                        {accountsForKeyring(kr.id).length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                  <Show when={isWalletExpanded(kr.id)}>
                    <div class="border-t border-divider/80 bg-base/20">
                      <For each={accountsForKeyring(kr.id)}>
                        {(row) => {
                          const isSel = () => row.accountArrayIndex === activeIndex();
                          return (
                            <button
                              type="button"
                              role="option"
                              aria-selected={isSel()}
                              onClick={() => selectAccount(row.accountArrayIndex)}
                              class={`w-full flex items-center gap-2.5 pl-7 pr-3 py-2 text-left transition-colors cursor-pointer
                                ${isSel() ? "bg-accent-light/60" : "hover:bg-base/50"}`}
                            >
                              <div class="shrink-0 rounded-full overflow-hidden ring-1 ring-divider/60">
                                <Identicon address={row.account.address} size={28} />
                              </div>
                              <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-text-primary truncate">
                                  {row.account.name}
                                </p>
                                <p class="text-[11px] font-mono text-text-tertiary truncate">
                                  {truncateAddress(row.account.address)}
                                </p>
                              </div>
                              {isSel() && <Check size={16} class="shrink-0 text-accent" />}
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>

            <Show when={importedRows().length > 0}>
              <div class="border-b border-divider last:border-b-0">
                <button
                  type="button"
                  class="group flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-base/50 transition-colors cursor-pointer"
                  onClick={() => toggleWalletExpanded(IMPORTED_KEYRING_ID)}
                >
                  <span class="shrink-0 p-0.5 text-text-tertiary group-hover:text-text-secondary">
                    <ChevronRight
                      size={16}
                      class={`transition-transform ${
                        isWalletExpanded(IMPORTED_KEYRING_ID) ? "rotate-90" : ""
                      }`}
                    />
                  </span>
                  <span
                    class={`w-2.5 h-2.5 rounded-full shrink-0 ${keyringDotClass(IMPORTED_KEYRING_ID)}`}
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-text-primary truncate">
                      Private key wallet
                    </p>
                    <p class="text-[11px] text-text-tertiary">
                      {importedRows().length} account{importedRows().length === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
                <Show when={isWalletExpanded(IMPORTED_KEYRING_ID)}>
                  <div class="border-t border-divider/80 bg-base/20">
                    <For each={importedRows()}>
                      {(row) => {
                        const isSel = () => row.accountArrayIndex === activeIndex();
                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSel()}
                            onClick={() => selectAccount(row.accountArrayIndex)}
                            class={`w-full flex items-center gap-2.5 pl-7 pr-3 py-2 text-left transition-colors cursor-pointer
                              ${isSel() ? "bg-accent-light/60" : "hover:bg-base/50"}`}
                          >
                            <div class="shrink-0 rounded-full overflow-hidden ring-1 ring-divider/60">
                              <Identicon address={row.account.address} size={28} />
                            </div>
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-medium text-text-primary truncate">
                                {row.account.name}
                              </p>
                              <p class="text-[11px] font-mono text-text-tertiary truncate">
                                {truncateAddress(row.account.address)}
                              </p>
                            </div>
                            {isSel() && <Check size={16} class="shrink-0 text-accent" />}
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
