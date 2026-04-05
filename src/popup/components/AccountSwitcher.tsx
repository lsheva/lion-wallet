import { truncateAddress } from "@shared/format";
import { Check, ChevronDown, LoaderCircle } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { keyringDotClass } from "../keyring-ui";
import { fetchActivity, walletState } from "../store";
import { AddressDisplay } from "./AddressDisplay";
import { Identicon } from "./Identicon";
import { BalanceSkeleton } from "./Skeleton";

interface AccountSwitcherProps {
  usdTotal: string;
  loading?: boolean;
}

export function AccountSwitcher(props: AccountSwitcherProps) {
  const [open, setOpen] = createSignal(false);
  const [selectedHdKeyringId, setSelectedHdKeyringId] = createSignal<string | null>(null);
  let rootRef: HTMLDivElement | undefined;

  const rows = () => walletState.homeAccountsForSwitcher();
  const active = () => walletState.activeAccount();
  const activeIndex = () => walletState.activeAccountIndex();
  const multi = () => rows().length > 1;

  const hdKeyrings = createMemo(() => walletState.keyrings().filter((k) => k.type === "hd"));

  const importedRows = createMemo(() =>
    rows().filter((r) => r.account.path === "imported"),
  );

  const hdRowsForSelectedKeyring = createMemo(() => {
    const kid = selectedHdKeyringId();
    if (!kid) return [];
    return rows().filter(
      (r) => r.account.path !== "imported" && r.account.keyringId === kid,
    );
  });

  const activeKeyringLabel = createMemo(() => {
    const a = active();
    return walletState.keyrings().find((k) => k.id === a.keyringId)?.label ?? "";
  });

  createEffect(
    on(open, (isOpen) => {
      if (!isOpen) return;
      const a = active();
      const hd = hdKeyrings();
      if (a.path !== "imported") {
        setSelectedHdKeyringId(a.keyringId);
      } else if (hd[0]) {
        setSelectedHdKeyringId(hd[0].id);
      } else {
        setSelectedHdKeyringId(null);
      }
    }),
  );

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
          class="absolute left-3 right-3 top-full z-[60] mt-0.5 rounded-xl border border-divider bg-surface shadow-lg py-2 max-h-[min(320px,70vh)] overflow-y-auto"
          role="listbox"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Show when={hdKeyrings().length > 0}>
            <div class="px-3 pb-2">
              <p class="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-2">
                Mnemonic wallets
              </p>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <For each={hdKeyrings()}>
                  {(kr) => (
                    <button
                      type="button"
                      onClick={() => setSelectedHdKeyringId(kr.id)}
                      class={`inline-flex items-center gap-1.5 max-w-full rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer border ${
                        selectedHdKeyringId() === kr.id
                          ? "border-accent bg-accent-light text-text-primary"
                          : "border-divider/80 bg-base/50 text-text-secondary hover:border-divider"
                      }`}
                    >
                      <span class={`w-2 h-2 rounded-full shrink-0 ${keyringDotClass(kr.id)}`} />
                      <span class="truncate">{kr.label}</span>
                    </button>
                  )}
                </For>
              </div>
              <For each={hdRowsForSelectedKeyring()}>
                {(row) => {
                  const isActive = () => row.accountArrayIndex === activeIndex();
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive()}
                      onClick={() => selectAccount(row.accountArrayIndex)}
                      class={`
                  w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors cursor-pointer
                  ${isActive() ? "bg-divider/50" : "hover:bg-divider/30"}
                `}
                    >
                      <div class="shrink-0 rounded-full overflow-hidden ring-1 ring-divider/60">
                        <Identicon address={row.account.address} size={28} />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-text-primary truncate">{row.account.name}</p>
                        <p class="text-[11px] font-mono text-text-tertiary truncate">
                          {truncateAddress(row.account.address)}
                        </p>
                      </div>
                      {isActive() && <Check size={16} class="shrink-0 text-accent" />}
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>

          <Show when={importedRows().length > 0}>
            <div
              class={`px-3 ${hdKeyrings().length > 0 ? "border-t border-divider pt-3 mt-1" : ""}`}
            >
              <p class="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-2">
                Imported keys
              </p>
              <For each={importedRows()}>
                {(row) => {
                  const isActive = () => row.accountArrayIndex === activeIndex();
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive()}
                      onClick={() => selectAccount(row.accountArrayIndex)}
                      class={`
                  w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors cursor-pointer
                  ${isActive() ? "bg-divider/50" : "hover:bg-divider/30"}
                `}
                    >
                      <div class="shrink-0 rounded-full overflow-hidden ring-1 ring-divider/60">
                        <Identicon address={row.account.address} size={28} />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-text-primary truncate">{row.account.name}</p>
                        <p class="text-[11px] font-mono text-text-tertiary truncate">
                          {truncateAddress(row.account.address)}
                        </p>
                      </div>
                      {isActive() && <Check size={16} class="shrink-0 text-accent" />}
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
