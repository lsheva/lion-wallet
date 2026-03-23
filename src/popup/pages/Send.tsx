import { POPUP_ORIGIN } from "@shared/constants";
import { toErrorMessage } from "@shared/format";
import { sendMessage } from "@shared/messages";
import { useNavigate } from "@solidjs/router";
import { BookUser, ChevronDown } from "lucide-solid";
import { batch, createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import type { Address } from "viem";
import { numberToHex, parseEther } from "viem/utils";

const addressRegex = /^0x[a-fA-F0-9]{40}$/;
const isAddress = (value: string): boolean => addressRegex.test(value);

import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChainIcon } from "../components/ChainIcon";
import { FormattedTokenValue } from "../components/FormattedTokenValue";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { TokenImage } from "../components/TokenImage";
import { accounts, activeAccountIndex, type Token, walletState } from "../store";

const isNative = (token: Token) => !token.address;

export function Send() {
  const navigate = useNavigate();

  const [to, setTo] = createSignal("");
  const [amount, setAmount] = createSignal("");
  const [selectedToken, setSelectedToken] = createSignal<Token>(walletState.tokens()[0] as Token);
  const [showTokenPicker, setShowTokenPicker] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [balance, setBalance] = createSignal<string | null>(null);
  const [loadingBalance, setLoadingBalance] = createSignal(false);
  const [showAddressPicker, setShowAddressPicker] = createSignal(false);
  let addressPickerRef: HTMLDivElement | undefined;

  const onClickOutside = (e: MouseEvent) => {
    if (showAddressPicker() && addressPickerRef && !addressPickerRef.contains(e.target as Node)) {
      setShowAddressPicker(false);
    }
  };
  document.addEventListener("pointerdown", onClickOutside);
  onCleanup(() => document.removeEventListener("pointerdown", onClickOutside));

  const addressValid = createMemo(() => to().length === 0 || isAddress(to()));
  const selectedRecipientAccount = createMemo(() =>
    accounts().find((a) => a.address.toLowerCase() === to().toLowerCase()),
  );
  const rawBalance = createMemo(() => balance() ?? selectedToken().balance);
  const numericBalance = createMemo(() => parseFloat(rawBalance().replace(/,/g, "")));
  const numericAmount = createMemo(() => parseFloat(amount().replace(/,/g, "") || "0"));
  const insufficientBalance = createMemo(
    () => numericAmount() > 0 && numericAmount() > numericBalance(),
  );
  const canSubmit = createMemo(
    () =>
      to().length > 0 &&
      isAddress(to()) &&
      numericAmount() > 0 &&
      !insufficientBalance() &&
      !submitting(),
  );

  async function fetchTokenBalance(token: Token, networkId: number) {
    setLoadingBalance(true);
    try {
      if (isNative(token)) {
        const account = walletState.activeAccount();
        const res = await sendMessage({
          type: "GET_BALANCE",
          address: account.address as Address,
          chainId: networkId,
        });
        if (res.ok && res.data) {
          setBalance(res.data.balance);
        }
      } else {
        const res = await sendMessage({
          type: "GET_TOKEN_BALANCES",
          tokens: [token.address as Address],
        });
        if (res.ok && res.data) {
          const raw = BigInt(res.data.balances[token.address as string] ?? "0");
          const formatted = (Number(raw) / 10 ** token.decimals).toString();
          setBalance(formatted);
        }
      }
    } catch (e) {
      console.warn("[Send] fetchBalance failed:", e);
    } finally {
      setLoadingBalance(false);
    }
  }

  createEffect(
    on(
      () => [selectedToken(), walletState.activeNetwork().id] as const,
      ([token, networkId]) => {
        setBalance(null);
        fetchTokenBalance(token, networkId);
      },
    ),
  );

  const handleMax = () => {
    setAmount(rawBalance().replace(/,/g, ""));
  };

  const handleSelectAddress = (address: string) => {
    setTo(address);
    setShowAddressPicker(false);
    setError(null);
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const handleSelectToken = (token: Token) => {
    batch(() => {
      setSelectedToken(token);
      setShowTokenPicker(false);
      setAmount("");
    });
  };

  const handleReview = async () => {
    setError(null);

    if (!isAddress(to())) {
      setError("Invalid recipient address");
      return;
    }
    if (numericAmount() <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (insufficientBalance()) {
      setError("Insufficient balance");
      return;
    }

    setSubmitting(true);
    try {
      const cleanAmount = amount().replace(/,/g, "");
      if (isNative(selectedToken())) {
        const account = walletState.activeAccount();
        await sendMessage({
          type: "RPC_REQUEST",
          id: crypto.randomUUID(),
          method: "eth_sendTransaction",
          params: [
            { from: account.address, to: to(), value: numberToHex(parseEther(cleanAmount)) },
          ],
          origin: POPUP_ORIGIN,
        });
      } else {
        await sendMessage({
          type: "SEND_TOKEN",
          tokenAddress: selectedToken().address as Address,
          to: to() as Address,
          amount: cleanAmount,
          decimals: selectedToken().decimals,
        });
      }
      navigate("/approve", { replace: true });
    } catch (e) {
      setError(toErrorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Send" onBack="/home" />

      <div class="flex-1 px-4 pt-4 space-y-4 overflow-y-auto">
        {/* Token selector */}
        <div>
          <span class="block text-sm font-medium text-text-secondary mb-1.5">Token</span>
          <button
            type="button"
            onClick={() => setShowTokenPicker(!showTokenPicker())}
            class="w-full flex items-center justify-between px-3 py-2.5 bg-surface rounded-[var(--radius-card)] ring-1 ring-transparent hover:ring-accent/30 transition-shadow cursor-pointer"
          >
            <div class="flex items-center gap-2.5">
              <Show
                when={isNative(selectedToken())}
                fallback={
                  <TokenImage
                    address={selectedToken().address}
                    chainId={walletState.activeNetwork().id}
                    symbol={selectedToken().symbol}
                    color={selectedToken().color}
                    size={28}
                  />
                }
              >
                <ChainIcon chainId={walletState.activeNetwork().id} size={28} />
              </Show>
              <div class="text-left">
                <span class="text-sm font-medium text-text-primary">{selectedToken().symbol}</span>
                <span class="text-xs text-text-tertiary ml-1.5">{selectedToken().name}</span>
              </div>
            </div>
            <ChevronDown
              size={16}
              class={`text-text-tertiary transition-transform ${showTokenPicker() ? "rotate-180" : ""}`}
            />
          </button>
          <Show when={showTokenPicker()}>
            <Card class="mt-1.5 !p-0 overflow-hidden">
              <For each={walletState.tokens()}>
                {(token) => (
                  <button
                    type="button"
                    onClick={() => handleSelectToken(token)}
                    class={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-base/50 transition-colors cursor-pointer text-left ${
                      token.symbol === selectedToken().symbol ? "bg-accent-light" : ""
                    }`}
                  >
                    <Show
                      when={isNative(token)}
                      fallback={
                        <TokenImage
                          address={token.address}
                          chainId={walletState.activeNetwork().id}
                          symbol={token.symbol}
                          color={token.color}
                          size={24}
                        />
                      }
                    >
                      <ChainIcon chainId={walletState.activeNetwork().id} size={24} />
                    </Show>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-text-primary">{token.symbol}</p>
                    </div>
                    <span class="text-xs font-mono text-text-secondary">
                      <FormattedTokenValue value={token.balance} />
                    </span>
                  </button>
                )}
              </For>
            </Card>
          </Show>
        </div>

        {/* Recipient */}
        <div>
          <span class="block text-sm font-medium text-text-secondary mb-1.5">To</span>
          <div class="relative" ref={addressPickerRef}>
            <div
              class={`bg-surface rounded-[var(--radius-card)] ring-1 transition-shadow duration-150 ${
                to().length > 0 && !addressValid()
                  ? "ring-danger"
                  : "ring-transparent focus-within:ring-accent/40 focus-within:ring-2"
              }`}
            >
              <div class="relative">
                <input
                  class={`w-full bg-transparent px-3 py-2.5 text-text-primary text-[11px] font-mono placeholder:text-text-tertiary outline-none rounded-[var(--radius-card)] ${
                    accounts().length > 1 ? "pr-8" : ""
                  }`}
                  type="text"
                  placeholder="0x..."
                  value={to()}
                  onInput={(e) => {
                    setTo(e.currentTarget.value);
                    setError(null);
                    setShowAddressPicker(false);
                  }}
                />
                <Show when={accounts().length > 1}>
                  <button
                    type="button"
                    onClick={() => setShowAddressPicker(!showAddressPicker())}
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                  >
                    <BookUser size={16} />
                  </button>
                </Show>
              </div>
            </div>
            <Show when={showAddressPicker()}>
              <div class="absolute left-0 right-0 top-full mt-1 z-20 bg-elevated rounded-[var(--radius-card)] ring-1 ring-divider shadow-lg overflow-y-auto max-h-[160px]">
                <For each={accounts()}>
                  {(account, i) => (
                    <button
                      type="button"
                      onClick={() => handleSelectAddress(account.address)}
                      class={`w-full flex items-center justify-between px-3 py-2 hover:bg-base/50 transition-colors cursor-pointer text-left ${
                        account.address.toLowerCase() === to().toLowerCase()
                          ? "bg-accent-light"
                          : ""
                      }`}
                    >
                      <span class="text-sm font-medium text-text-primary truncate">
                        {account.name}
                        <Show when={i() === activeAccountIndex()}>
                          <span class="text-[11px] text-text-tertiary ml-1">(sender)</span>
                        </Show>
                      </span>
                      <span class="text-[11px] font-mono text-text-secondary ml-2 shrink-0">
                        {truncateAddress(account.address)}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <Show when={selectedRecipientAccount() && addressValid()}>
            <p class="text-xs text-text-tertiary mt-1">
              Sending to: <span class="font-medium">{selectedRecipientAccount()?.name}</span>
            </p>
          </Show>
          <Show when={to().length > 0 && !addressValid()}>
            <p class="text-xs text-danger mt-1.5">Invalid address</p>
          </Show>
        </div>

        {/* Amount */}
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium text-text-secondary">Amount</span>
            <button
              type="button"
              onClick={handleMax}
              class="flex items-center gap-1 text-xs cursor-pointer"
            >
              <span class="text-text-tertiary">
                Bal:{" "}
                <span class="font-mono">
                  <Show
                    when={loadingBalance()}
                    fallback={<FormattedTokenValue value={rawBalance()} />}
                  >
                    <Skeleton width={48} height={12} class="inline-block align-middle" />
                  </Show>
                </span>
              </span>
              <span class="font-semibold text-accent hover:text-accent-hover transition-colors">
                MAX
              </span>
            </button>
          </div>
          <Input
            placeholder="0.0"
            value={amount()}
            onInput={(v) => {
              setAmount(v);
              setError(null);
            }}
            mono
            error={insufficientBalance() ? "Insufficient balance" : undefined}
            rightSlot={
              <span class="text-xs font-medium text-text-secondary bg-base px-2 py-0.5 rounded-md">
                {selectedToken().symbol}
              </span>
            }
          />
        </div>

        <Show when={error()}>
          <Banner variant="danger">{error()}</Banner>
        </Show>
      </div>

      <div class="px-4 py-4">
        <Button onClick={handleReview} disabled={!canSubmit()} loading={submitting()} size="lg">
          Review Transaction
        </Button>
      </div>
    </div>
  );
}
