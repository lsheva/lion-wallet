import { POPUP_ORIGIN } from "@shared/constants";
import { toErrorMessage } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { MultiSendEntry } from "@shared/types";
import { BookUser, ChevronDown, ExternalLink, Plus, Trash2, X } from "lucide-solid";
import { createMemo, createSignal, Index, onCleanup, Show } from "solid-js";
import type { Address } from "viem";
import { numberToHex, parseEther } from "viem/utils";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { ChainIcon } from "../components/ChainIcon";
import { Header } from "../components/Header";
import { TokenImage } from "../components/TokenImage";
import { useNavigate } from "../router";
import { accounts, activeAccountIndex, type Token, walletState } from "../store";
import { showError } from "../toast";

const addressRegex = /^0x[a-fA-F0-9]{40}$/;
const isAddress = (value: string): boolean => addressRegex.test(value);
const isNative = (token: Token) => !token.address;
const truncAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

interface Recipient {
  id: number;
  to: string;
  amount: string;
}

interface TokenGroup {
  id: number;
  token: Token;
  useSameRecipients: boolean;
  uniformAmount: boolean;
  singleAmount: string;
  recipients: Recipient[];
}

let nextRId = 0;
let nextGId = 0;
const emptyR = (): Recipient => ({ id: nextRId++, to: "", amount: "" });
const mkGroup = (token: Token, same = false): TokenGroup => ({
  id: nextGId++,
  token,
  useSameRecipients: same,
  uniformAmount: true,
  singleAmount: "",
  recipients: [emptyR()],
});

export function Send() {
  const navigate = useNavigate();

  const disperseOk = createMemo(() => !!walletState.activeNetwork().disperseAddress);
  const disperseAddr = createMemo(() => walletState.activeNetwork().disperseAddress);
  const explorer = createMemo(() => walletState.activeNetwork().blockExplorerUrl);

  const defaultToken = () => walletState.tokens()[0] as Token;

  const [groups, setGroups] = createSignal<TokenGroup[]>([mkGroup(defaultToken())]);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [openPicker, setOpenPicker] = createSignal<number | null>(null);
  const [openAddrPicker, setOpenAddrPicker] = createSignal<number | null>(null);

  const onClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (openAddrPicker() !== null && !target.closest("[data-addr-picker]")) {
      setOpenAddrPicker(null);
    }
  };
  document.addEventListener("pointerdown", onClickOutside);
  onCleanup(() => document.removeEventListener("pointerdown", onClickOutside));

  const isMulti = createMemo(() => {
    const g = groups();
    return g.length > 1 || (g[0] != null && g[0].recipients.length > 1);
  });

  const txCount = createMemo(() => {
    if (!isMulti()) return 1;
    const g = groups();
    if (!disperseOk()) {
      return g.reduce((s, gr) => {
        const n = gr.useSameRecipients ? (g[0]?.recipients.length ?? 0) : gr.recipients.length;
        return s + n;
      }, 0);
    }
    const hasNative = g.some((gr) => isNative(gr.token));
    const erc20 = g.filter((gr) => !isNative(gr.token)).length;
    let c = erc20;
    if (erc20 > 0) c++;
    if (hasNative) c++;
    return Math.max(c, 1);
  });

  const matchAccount = (addr: string) =>
    isAddress(addr)
      ? accounts().find((a) => a.address.toLowerCase() === addr.toLowerCase())
      : undefined;

  /* ── mutations ── */

  function updateRecipient(gId: number, rId: number, patch: Partial<Recipient>) {
    setGroups((p) =>
      p.map((g) =>
        g.id === gId
          ? { ...g, recipients: g.recipients.map((r) => (r.id === rId ? { ...r, ...patch } : r)) }
          : g,
      ),
    );
    setError(null);
  }

  function addRecipient(gId: number) {
    setGroups((p) =>
      p.map((g) => (g.id === gId ? { ...g, recipients: [...g.recipients, emptyR()] } : g)),
    );
  }

  function removeRecipient(gId: number, rId: number) {
    setGroups((p) =>
      p.map((g) => {
        if (g.id !== gId || g.recipients.length <= 1) return g;
        return { ...g, recipients: g.recipients.filter((r) => r.id !== rId) };
      }),
    );
  }

  function setGroupToken(gId: number, token: Token) {
    setGroups((p) => p.map((g) => (g.id === gId ? { ...g, token } : g)));
    setOpenPicker(null);
    setError(null);
  }

  function toggleSameRecipients(gId: number, v: boolean) {
    setGroups((p) => p.map((g) => (g.id === gId ? { ...g, useSameRecipients: v } : g)));
  }

  function toggleUniformAmount(gId: number, uniform: boolean) {
    setGroups((p) =>
      p.map((g) => {
        if (g.id !== gId) return g;
        if (uniform) {
          return {
            ...g,
            uniformAmount: true,
            singleAmount: g.recipients[0]?.amount ?? g.singleAmount,
          };
        }
        return {
          ...g,
          uniformAmount: false,
          recipients: g.recipients.map((r) => ({ ...r, amount: g.singleAmount })),
        };
      }),
    );
  }

  function updateSingleAmount(gId: number, amount: string) {
    setGroups((p) => p.map((g) => (g.id === gId ? { ...g, singleAmount: amount } : g)));
    setError(null);
  }

  function addTokenGroup() {
    const used = new Set(groups().map((g) => g.token.symbol));
    const next = walletState.tokens().find((t) => !used.has(t.symbol)) ?? defaultToken();
    setGroups((p) => [...p, mkGroup(next, true)]);
  }

  function removeGroup(gId: number) {
    setGroups((p) => (p.length <= 1 ? p : p.filter((g) => g.id !== gId)));
  }

  function syncAmount(gId: number, idx: number, amount: string) {
    setGroups((p) =>
      p.map((g) => {
        if (g.id !== gId) return g;
        const rs = [...g.recipients];
        while (rs.length <= idx) rs.push(emptyR());
        rs[idx] = { ...rs[idx]!, amount };
        return { ...g, recipients: rs };
      }),
    );
    setError(null);
  }

  /* ── display helpers ── */

  function displayRecs(gi: number) {
    const g = groups();
    const grp = g[gi]!;
    if (!grp.useSameRecipients || gi === 0) return grp.recipients;
    const first = g[0];
    if (!first) return grp.recipients;
    return first.recipients.map((r, i) => ({
      id: r.id,
      to: r.to,
      amount: grp.recipients[i]?.amount ?? "",
    }));
  }

  function getAmount(grp: TokenGroup, rec: Recipient) {
    return grp.uniformAmount ? grp.singleAmount : rec.amount;
  }

  /* ── validation ── */

  const allValid = createMemo(() =>
    groups().every((grp, gi) => {
      const recs = displayRecs(gi);
      const addressesOk = recs.every((r) => isAddress(r.to));
      const amountsOk = grp.uniformAmount
        ? parseFloat(grp.singleAmount.replace(/,/g, "") || "0") > 0
        : recs.every((r) => parseFloat(r.amount.replace(/,/g, "") || "0") > 0);
      return addressesOk && amountsOk;
    }),
  );

  const canSubmit = createMemo(() => allValid() && !submitting());

  /* ── submit ── */

  const handleReview = async () => {
    setError(null);
    const g = groups();

    if (!isMulti()) {
      const grp = g[0]!;
      const rec = grp.recipients[0]!;
      if (!isAddress(rec.to)) {
        setError("Invalid recipient address");
        return;
      }
      const rawAmt = getAmount(grp, rec);
      if (parseFloat(rawAmt.replace(/,/g, "") || "0") <= 0) {
        setError("Enter a valid amount");
        return;
      }

      setSubmitting(true);
      try {
        const amt = rawAmt.replace(/,/g, "");
        if (isNative(grp.token)) {
          await sendMessage({
            type: "RPC_REQUEST",
            id: crypto.randomUUID(),
            method: "eth_sendTransaction",
            params: [
              {
                from: walletState.activeAccount().address,
                to: rec.to,
                value: numberToHex(parseEther(amt)),
              },
            ],
            origin: POPUP_ORIGIN,
          });
        } else {
          await sendMessage({
            type: "SEND_TOKEN",
            tokenAddress: grp.token.address as Address,
            to: rec.to as Address,
            amount: amt,
            decimals: grp.token.decimals,
          });
        }
        navigate("/approve", { replace: true });
      } catch (e) {
        setError("Transaction could not be prepared");
        showError("Transaction could not be prepared", toErrorMessage(e));
        setSubmitting(false);
      }
      return;
    }

    /* multi-send */
    setSubmitting(true);
    try {
      const entries: MultiSendEntry[] = [];
      for (let gi = 0; gi < g.length; gi++) {
        const grp = g[gi]!;
        const recs = displayRecs(gi);
        for (const r of recs) {
          entries.push({
            to: r.to as Address,
            tokenAddress: grp.token.address as Address | undefined,
            amount: getAmount(grp, r).replace(/,/g, ""),
            decimals: grp.token.decimals,
            symbol: grp.token.symbol,
            tokenName: grp.token.name,
          });
        }
      }
      const res = await sendMessage({ type: "MULTI_SEND", entries });
      if (!res.ok) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      navigate("/approve", { replace: true });
    } catch (e) {
      setError("Could not prepare multi-send");
      showError("Could not prepare multi-send", toErrorMessage(e));
      setSubmitting(false);
    }
  };

  /* ── render ── */

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Send" onBack="/home" />

      <div class="flex-1 px-4 pt-3 overflow-y-auto pb-2">
        <Index each={groups()}>
          {(_, gi) => {
            const grp = () => groups()[gi]!;
            const isFirst = () => gi === 0;
            const recs = () => displayRecs(gi);

            const recipientLabel = () => (recs().length > 1 ? "Recipients" : "Recipient");
            const amountLabel = () => {
              if (recs().length <= 1) return "Amount";
              return grp().uniformAmount ? "Amount each" : "Amounts";
            };

            return (
              <div
                class={`space-y-4 ${gi > 0 ? "mt-8 pt-6 border-t-2 border-divider-strong" : ""}`}
              >

                {/* ── Token ── */}
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-sm font-medium text-text-secondary">
                      {groups().length > 1 ? `Token #${gi + 1}` : "Token"}
                    </span>
                    <Show when={groups().length > 1}>
                      <button
                        type="button"
                        onClick={() => removeGroup(grp().id)}
                        class="text-text-tertiary hover:text-danger transition-colors cursor-pointer p-0.5"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Show>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpenPicker(openPicker() === grp().id ? null : grp().id)}
                    class="w-full flex items-center justify-between px-3 py-2.5 bg-surface rounded-[var(--radius-card)] ring-1 ring-transparent hover:ring-accent/30 transition-shadow cursor-pointer"
                  >
                    <div class="flex items-center gap-2">
                      <Show
                        when={isNative(grp().token)}
                        fallback={
                          <TokenImage
                            address={grp().token.address}
                            chainId={walletState.activeNetwork().id}
                            symbol={grp().token.symbol}
                            color={grp().token.color}
                            size={20}
                          />
                        }
                      >
                        <ChainIcon chainId={walletState.activeNetwork().id} size={20} />
                      </Show>
                      <span class="text-sm font-medium text-text-primary">
                        {grp().token.symbol}
                      </span>
                      <span class="ml-1 text-xs font-mono text-text-tertiary">
                        {grp().token.balance}
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      class={`text-text-tertiary transition-transform ${openPicker() === grp().id ? "rotate-180" : ""}`}
                    />
                  </button>

                  <Show when={openPicker() === grp().id}>
                    <div class="bg-surface rounded-[var(--radius-card)] ring-1 ring-divider mt-1 max-h-[120px] overflow-y-auto">
                      <Index each={walletState.tokens()}>
                        {(tok) => (
                          <button
                            type="button"
                            onClick={() => setGroupToken(grp().id, tok())}
                            class={`w-full flex items-center gap-2 px-3 py-2 hover:bg-base/50 transition-colors cursor-pointer text-left ${tok().symbol === grp().token.symbol ? "bg-accent-light" : ""}`}
                          >
                            <Show
                              when={isNative(tok())}
                              fallback={
                                <TokenImage
                                  address={tok().address}
                                  chainId={walletState.activeNetwork().id}
                                  symbol={tok().symbol}
                                  color={tok().color}
                                  size={18}
                                />
                              }
                            >
                              <ChainIcon chainId={walletState.activeNetwork().id} size={18} />
                            </Show>
                            <span class="text-xs font-medium text-text-primary">
                              {tok().symbol}
                            </span>
                            <span class="ml-auto text-[10px] font-mono text-text-tertiary">
                              {tok().balance}
                            </span>
                          </button>
                        )}
                      </Index>
                    </div>
                  </Show>
                </div>

                {/* ── Recipient (editable) ── */}
                <Show when={!grp().useSameRecipients || isFirst()}>
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-sm font-medium text-text-secondary">
                        {recipientLabel()}
                      </span>
                      <div class="flex items-center gap-3">
                        <Show when={!isFirst()}>
                          <label class="flex items-center gap-1.5 cursor-pointer select-none">
                            <span class="text-xs text-text-tertiary">Same as #1</span>
                            <input
                              type="checkbox"
                              checked={grp().useSameRecipients}
                              onChange={(e) =>
                                toggleSameRecipients(grp().id, e.currentTarget.checked)
                              }
                              class="sr-only peer"
                            />
                            <div
                              class={`relative w-8 h-[18px] rounded-full transition-colors pointer-events-none ${
                                grp().useSameRecipients ? "bg-accent" : "bg-text-tertiary/30"
                              }`}
                            >
                              <div
                                class={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
                                  grp().useSameRecipients
                                    ? "translate-x-[16px]"
                                    : "translate-x-[2px]"
                                }`}
                              />
                            </div>
                          </label>
                        </Show>
                        <button
                          type="button"
                          onClick={() => addRecipient(grp().id)}
                          class="text-[11px] font-semibold uppercase tracking-wide text-accent hover:text-accent-hover transition-colors cursor-pointer px-1"
                        >
                          Add more
                        </button>
                      </div>
                    </div>
                    <div class="space-y-2">
                      <Index each={recs()}>
                        {(rec) => {
                          const matched = () => matchAccount(rec().to);
                          return (
                            <div data-addr-picker class="relative">
                              <div class="flex items-center gap-1">
                                <Show
                                  when={matched()}
                                  fallback={
                                    <div class="relative flex-1">
                                      <input
                                        class={`w-full bg-surface rounded-[var(--radius-card)] px-3 py-2.5 pr-10 text-sm font-mono text-text-primary placeholder:text-text-tertiary outline-none ring-1 transition-shadow ${
                                          rec().to.length > 0 && !isAddress(rec().to)
                                            ? "ring-danger"
                                            : "ring-transparent focus:ring-accent/40 focus:ring-2"
                                        }`}
                                        type="text"
                                        placeholder="0x..."
                                        value={rec().to}
                                        onInput={(e) =>
                                          updateRecipient(grp().id, rec().id, {
                                            to: e.currentTarget.value,
                                          })
                                        }
                                      />
                                      <Show when={accounts().length > 0}>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setOpenAddrPicker(
                                              openAddrPicker() === rec().id ? null : rec().id,
                                            )
                                          }
                                          class="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                                        >
                                          <BookUser size={16} />
                                        </button>
                                      </Show>
                                    </div>
                                  }
                                >
                                  {(acct) => (
                                    <div class="flex-1 flex items-center gap-2 bg-surface rounded-[var(--radius-card)] px-3 py-2.5 ring-1 ring-accent/20">
                                      <span class="text-sm font-medium text-text-primary truncate">
                                        {acct().name}
                                      </span>
                                      <span class="text-xs font-mono text-text-tertiary shrink-0">
                                        {truncAddr(acct().address)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateRecipient(grp().id, rec().id, { to: "" })
                                        }
                                        class="ml-auto text-text-tertiary hover:text-danger transition-colors cursor-pointer shrink-0"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  )}
                                </Show>
                                <Show when={recs().length > 1}>
                                  <button
                                    type="button"
                                    onClick={() => removeRecipient(grp().id, rec().id)}
                                    class="text-text-tertiary hover:text-danger transition-colors cursor-pointer p-1 shrink-0"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </Show>
                              </div>

                              <Show when={openAddrPicker() === rec().id}>
                                <div class="absolute left-0 right-0 top-full mt-1 z-20 bg-elevated rounded-[var(--radius-card)] ring-1 ring-divider shadow-lg overflow-y-auto max-h-[160px]">
                                  <Index each={accounts()}>
                                    {(account, i) => (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateRecipient(grp().id, rec().id, {
                                            to: account().address,
                                          });
                                          setOpenAddrPicker(null);
                                        }}
                                        class={`w-full flex items-center justify-between px-3 py-2 hover:bg-base/50 transition-colors cursor-pointer text-left ${
                                          account().address.toLowerCase() ===
                                          rec().to.toLowerCase()
                                            ? "bg-accent-light"
                                            : ""
                                        }`}
                                      >
                                        <span class="text-sm font-medium text-text-primary truncate">
                                          {account().name}
                                          <Show when={i === activeAccountIndex()}>
                                            <span class="text-[11px] text-text-tertiary ml-1">
                                              (sender)
                                            </span>
                                          </Show>
                                        </span>
                                        <span class="text-[11px] font-mono text-text-secondary ml-2 shrink-0">
                                          {truncAddr(account().address)}
                                        </span>
                                      </button>
                                    )}
                                  </Index>
                                </div>
                              </Show>

                              <Show when={rec().to.length > 0 && !isAddress(rec().to)}>
                                <p class="text-xs text-danger mt-1">Invalid address</p>
                              </Show>
                            </div>
                          );
                        }}
                      </Index>
                    </div>
                  </div>
                </Show>

                {/* ── Recipient (read-only for secondary groups) ── */}
                <Show when={grp().useSameRecipients && !isFirst()}>
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-sm font-medium text-text-secondary">
                        {recipientLabel()}
                      </span>
                      <label class="flex items-center gap-1.5 cursor-pointer select-none">
                        <span class="text-xs text-text-tertiary">Same as #1</span>
                        <input
                          type="checkbox"
                          checked={grp().useSameRecipients}
                          onChange={(e) =>
                            toggleSameRecipients(grp().id, e.currentTarget.checked)
                          }
                          class="sr-only peer"
                        />
                        <div
                          class={`relative w-8 h-[18px] rounded-full transition-colors pointer-events-none ${
                            grp().useSameRecipients ? "bg-accent" : "bg-text-tertiary/30"
                          }`}
                        >
                          <div
                            class={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
                              grp().useSameRecipients
                                ? "translate-x-[16px]"
                                : "translate-x-[2px]"
                            }`}
                          />
                        </div>
                      </label>
                    </div>
                    <div class="space-y-2">
                      <Index each={recs()}>
                        {(rec) => {
                          const matched = () => matchAccount(rec().to);
                          return (
                            <div class="bg-surface/50 rounded-[var(--radius-card)] px-3 py-2.5 text-sm truncate">
                              <Show
                                when={matched()}
                                fallback={
                                  <span class="font-mono text-text-tertiary">
                                    {rec().to || "—"}
                                  </span>
                                }
                              >
                                {(acct) => (
                                  <>
                                    <span class="font-medium text-text-primary">
                                      {acct().name}
                                    </span>
                                    <span class="font-mono text-text-tertiary ml-1.5">
                                      {truncAddr(acct().address)}
                                    </span>
                                  </>
                                )}
                              </Show>
                            </div>
                          );
                        }}
                      </Index>
                    </div>
                  </div>
                </Show>

                {/* ── Amount ── */}
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-sm font-medium text-text-secondary">{amountLabel()}</span>
                    <Show when={recs().length > 1}>
                      <label class="flex items-center gap-1.5 cursor-pointer select-none">
                        <span class="text-xs text-text-tertiary">Different amounts</span>
                        <input
                          type="checkbox"
                          checked={!grp().uniformAmount}
                          onChange={(e) =>
                            toggleUniformAmount(grp().id, !e.currentTarget.checked)
                          }
                          class="sr-only peer"
                        />
                        <div
                          class={`relative w-8 h-[18px] rounded-full transition-colors pointer-events-none ${
                            !grp().uniformAmount ? "bg-accent" : "bg-text-tertiary/30"
                          }`}
                        >
                          <div
                            class={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
                              !grp().uniformAmount ? "translate-x-[16px]" : "translate-x-[2px]"
                            }`}
                          />
                        </div>
                      </label>
                    </Show>
                  </div>

                  <Show
                    when={grp().uniformAmount}
                    fallback={
                      <div class="space-y-2">
                        <Index each={recs()}>
                          {(rec, ri) => {
                            const matched = () => matchAccount(rec().to);
                            const label = () => {
                              const m = matched();
                              return m ? m.name : `Recipient ${ri + 1}`;
                            };
                            return (
                              <div class="relative">
                                <input
                                  class="w-full bg-surface rounded-[var(--radius-card)] px-3 py-2.5 pr-14 text-sm font-mono text-text-primary placeholder:text-text-tertiary outline-none ring-1 ring-transparent focus:ring-accent/40 focus:ring-2 transition-shadow"
                                  type="text"
                                  placeholder={label()}
                                  value={
                                    grp().useSameRecipients && !isFirst()
                                      ? (grp().recipients[ri]?.amount ?? "")
                                      : rec().amount
                                  }
                                  onInput={(e) => {
                                    if (grp().useSameRecipients && !isFirst()) {
                                      syncAmount(grp().id, ri, e.currentTarget.value);
                                    } else {
                                      updateRecipient(grp().id, rec().id, {
                                        amount: e.currentTarget.value,
                                      });
                                    }
                                  }}
                                />
                                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-text-secondary bg-base px-2 py-0.5 rounded-md">
                                  {grp().token.symbol}
                                </span>
                              </div>
                            );
                          }}
                        </Index>
                      </div>
                    }
                  >
                    <div class="relative">
                      <input
                        class="w-full bg-surface rounded-[var(--radius-card)] px-3 py-2.5 pr-14 text-sm font-mono text-text-primary placeholder:text-text-tertiary outline-none ring-1 ring-transparent focus:ring-accent/40 focus:ring-2 transition-shadow"
                        type="text"
                        placeholder="0.0"
                        value={grp().singleAmount}
                        onInput={(e) => updateSingleAmount(grp().id, e.currentTarget.value)}
                      />
                      <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-text-secondary bg-base px-2 py-0.5 rounded-md">
                        {grp().token.symbol}
                      </span>
                    </div>
                  </Show>
                </div>
              </div>
            );
          }}
        </Index>

        <div class="mt-4 space-y-3">
          <button
            type="button"
            onClick={addTokenGroup}
            class="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
          >
            <Plus size={14} /> Add one more token
          </button>

          <Show when={isMulti()}>
            <Show
              when={disperseOk()}
              fallback={
                <Banner variant="warning">
                  Disperse is not deployed on {walletState.activeNetwork().name}. Each transfer will
                  be sent as a separate transaction. Expected: {txCount()} transaction(s).
                </Banner>
              }
            >
              <Banner variant="info">
                Tokens will be submitted as a single transaction routed through the{" "}
                <Show when={explorer() && disperseAddr()} fallback={<>Disperse contract</>}>
                  <a
                    href={`${explorer()}/address/${disperseAddr()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline inline-flex items-center gap-0.5"
                  >
                    Disperse contract <ExternalLink size={10} />
                  </a>
                </Show>
                . Expected: {txCount()} transaction(s).
              </Banner>
            </Show>
          </Show>

          <Show when={error()}>
            <Banner variant="danger">{error()}</Banner>
          </Show>
        </div>
      </div>

      <div class="px-4 py-3">
        <Button onClick={handleReview} disabled={!canSubmit()} loading={submitting()} size="lg">
          {isMulti() ? `Review ${txCount()} Transaction(s)` : "Review Transaction"}
        </Button>
      </div>
    </div>
  );
}
