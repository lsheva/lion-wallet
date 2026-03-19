import { useState, useEffect, useCallback } from "preact/hooks";
import { route } from "preact-router";
import { Clipboard, ChevronDown } from "lucide-preact";
import {
  isAddress,
  parseEther,
  parseUnits,
  numberToHex,
  encodeFunctionData,
  erc20Abi,
  type Address,
  type Hex,
} from "viem";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Banner } from "../components/Banner";
import { sendMessage } from "@shared/messages";
import { POPUP_ORIGIN } from "@shared/constants";
import { walletState, type Token } from "../store";

const isNative = (token: Token) => !token.address;

function buildTxParams(
  token: Token,
  recipient: Address,
  amount: string,
): { to: Address; value?: Hex; data?: Hex } {
  if (isNative(token)) {
    return {
      to: recipient,
      value: numberToHex(parseEther(amount)),
    };
  }
  return {
    to: token.address as Address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, parseUnits(amount, token.decimals)],
    }),
  };
}

export function Send() {
  const tokens = walletState.tokens.value;
  const network = walletState.activeNetwork.value;

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<Token>(tokens[0]);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const addressValid = to.length === 0 || isAddress(to);
  const rawBalance = balance ?? selectedToken.balance;
  const numericBalance = parseFloat(rawBalance.replace(/,/g, ""));
  const numericAmount = parseFloat(amount.replace(/,/g, "") || "0");
  const insufficientBalance = numericAmount > 0 && numericAmount > numericBalance;
  const canSubmit =
    to.length > 0 &&
    isAddress(to) &&
    numericAmount > 0 &&
    !insufficientBalance &&
    !submitting;

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      if (isNative(selectedToken)) {
        const account = walletState.activeAccount.value;
        const res = await sendMessage({
          type: "GET_BALANCE",
          address: account.address as Address,
          chainId: network.id,
        });
        if (res.ok && res.data) {
          setBalance((res.data as { balance: string }).balance);
        }
      } else {
        const account = walletState.activeAccount.value;
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [account.address as Address],
        });
        const res = await sendMessage({
          type: "RPC_REQUEST",
          id: crypto.randomUUID(),
          method: "eth_call",
          params: [{ to: selectedToken.address, data }, "latest"],
          origin: POPUP_ORIGIN,
        });
        if (res.ok && res.data) {
          const hex = (res.data as { result: string }).result;
          const raw = BigInt(hex);
          const formatted = (
            Number(raw) / Math.pow(10, selectedToken.decimals)
          ).toString();
          setBalance(formatted);
        }
      }
    } catch {
      // fall back to mock balance
    } finally {
      setLoadingBalance(false);
    }
  }, [selectedToken, network.id]);

  useEffect(() => {
    setBalance(null);
    fetchBalance();
  }, [fetchBalance]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTo(text.trim());
    } catch {
      // clipboard permission denied
    }
  };

  const handleMax = () => {
    setAmount(rawBalance.replace(/,/g, ""));
  };

  const handleSelectToken = (token: Token) => {
    setSelectedToken(token);
    setShowTokenPicker(false);
    setAmount("");
  };

  const handleReview = async () => {
    setError(null);

    if (!isAddress(to)) {
      setError("Invalid recipient address");
      return;
    }
    if (numericAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (insufficientBalance) {
      setError("Insufficient balance");
      return;
    }

    setSubmitting(true);
    try {
      const txParams = buildTxParams(
        selectedToken,
        to as Address,
        amount.replace(/,/g, ""),
      );
      const account = walletState.activeAccount.value;

      await sendMessage({
        type: "RPC_REQUEST",
        id: crypto.randomUUID(),
        method: "eth_sendTransaction",
        params: [{ ...txParams, from: account.address }],
        origin: POPUP_ORIGIN,
      });

      route("/tx-approval");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create transaction");
      setSubmitting(false);
    }
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Send" onBack="/home" />

      <div class="flex-1 px-4 pt-4 space-y-4 overflow-y-auto">
        {/* Token selector */}
        <div>
          <span class="block text-sm font-medium text-text-secondary mb-1.5">
            Token
          </span>
          <button
            type="button"
            onClick={() => setShowTokenPicker(!showTokenPicker)}
            class="w-full flex items-center justify-between px-3 py-2.5 bg-surface rounded-[var(--radius-card)] ring-1 ring-transparent hover:ring-accent/30 transition-shadow cursor-pointer"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: selectedToken.color }}
              >
                {selectedToken.symbol.slice(0, 1)}
              </div>
              <div class="text-left">
                <span class="text-sm font-medium text-text-primary">
                  {selectedToken.symbol}
                </span>
                <span class="text-xs text-text-tertiary ml-1.5">
                  {selectedToken.name}
                </span>
              </div>
            </div>
            <ChevronDown
              size={16}
              class={`text-text-tertiary transition-transform ${showTokenPicker ? "rotate-180" : ""}`}
            />
          </button>
          {showTokenPicker && (
            <Card class="mt-1.5 !p-0 overflow-hidden">
              {tokens.map((token) => (
                <button
                  key={token.symbol}
                  type="button"
                  onClick={() => handleSelectToken(token)}
                  class={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-base/50 transition-colors cursor-pointer text-left ${
                    token.symbol === selectedToken.symbol
                      ? "bg-accent-light"
                      : ""
                  }`}
                >
                  <div
                    class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: token.color }}
                  >
                    {token.symbol.slice(0, 1)}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-primary">
                      {token.symbol}
                    </p>
                  </div>
                  <span class="text-xs font-mono text-text-secondary">
                    {token.balance}
                  </span>
                </button>
              ))}
            </Card>
          )}
        </div>

        {/* Recipient */}
        <Input
          label="To"
          placeholder="0x..."
          value={to}
          onInput={(v) => {
            setTo(v);
            setError(null);
          }}
          mono
          error={to.length > 0 && !addressValid ? "Invalid address" : undefined}
          rightSlot={
            <button
              type="button"
              onClick={handlePaste}
              class="text-text-tertiary hover:text-accent transition-colors cursor-pointer"
            >
              <Clipboard size={16} />
            </button>
          }
        />

        {/* Amount */}
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium text-text-secondary">
              Amount
            </span>
            <button
              type="button"
              onClick={handleMax}
              class="flex items-center gap-1 text-xs cursor-pointer"
            >
              <span class="text-text-tertiary">
                Bal:{" "}
                <span class="font-mono">
                  {loadingBalance ? "..." : rawBalance}
                </span>
              </span>
              <span class="font-semibold text-accent hover:text-accent-hover transition-colors">
                MAX
              </span>
            </button>
          </div>
          <Input
            placeholder="0.0"
            value={amount}
            onInput={(v) => {
              setAmount(v);
              setError(null);
            }}
            mono
            error={insufficientBalance ? "Insufficient balance" : undefined}
            rightSlot={
              <span class="text-xs font-medium text-text-secondary bg-base px-2 py-0.5 rounded-md">
                {selectedToken.symbol}
              </span>
            }
          />
        </div>

        {error && (
          <Banner variant="danger">
            {error}
          </Banner>
        )}
      </div>

      <div class="px-4 py-4">
        <Button
          onClick={handleReview}
          disabled={!canSubmit}
          loading={submitting}
          size="lg"
        >
          Review Transaction
        </Button>
      </div>
    </div>
  );
}
