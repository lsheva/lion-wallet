import { useState } from "preact/hooks";
import { route } from "preact-router";
import { Clipboard } from "lucide-preact";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { walletState } from "../mock/state";

export function Send() {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const network = walletState.activeNetwork.value;

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    setTo(text);
  };

  const handleMax = () => {
    setAmount(walletState.ethBalance.value);
  };

  const usdEstimate = amount ? `~$${(parseFloat(amount.replace(/,/g, "")) * 2385.0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Send" onBack="/home" />

      <div class="flex-1 px-4 pt-4 space-y-4">
        <Input
          label="To"
          placeholder="0x..."
          value={to}
          onInput={setTo}
          mono
          rightSlot={
            <button onClick={handlePaste} class="text-text-tertiary hover:text-accent transition-colors cursor-pointer">
              <Clipboard size={16} />
            </button>
          }
        />

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-sm font-medium text-text-secondary">Amount</label>
            <span class="text-xs font-medium text-text-secondary bg-surface px-2 py-0.5 rounded-md">
              {network.symbol}
            </span>
          </div>
          <Input
            placeholder="0.0"
            value={amount}
            onInput={setAmount}
            mono
            rightSlot={
              <button
                onClick={handleMax}
                class="text-xs font-semibold text-accent hover:text-accent-hover transition-colors cursor-pointer"
              >
                MAX
              </button>
            }
          />
          <p class="text-xs text-text-tertiary mt-1.5">{usdEstimate} USD</p>
        </div>

        <Card>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-text-secondary">Network fee</span>
              <span class="text-text-primary font-mono">~$2.40</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-text-secondary">Estimated time</span>
              <span class="text-text-primary">~12 sec</span>
            </div>
          </div>
        </Card>
      </div>

      <div class="px-4 py-4">
        <Button
          onClick={() => route("/tx-approval")}
          disabled={!to || !amount}
          size="lg"
        >
          Review Transaction
        </Button>
      </div>
    </div>
  );
}
