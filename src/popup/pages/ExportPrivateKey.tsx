import { useState } from "preact/hooks";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { Card } from "../components/Card";
import { CopyButton } from "../components/CopyButton";
import { Eye, EyeOff } from "lucide-preact";
import { walletState } from "../mock/state";

const MOCK_PRIVATE_KEY = "0x4c0883a69102937d6231471b5dbb6204fe512961708279f23efb3d5a8c7b4a92";

export function ExportPrivateKey() {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const account = walletState.activeAccount.value;

  const handleReveal = () => {
    if (password.length < 4) {
      setError("Incorrect password");
      return;
    }
    setError("");
    setRevealed(true);
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Export Private Key" onBack="/settings" />

      <div class="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
        <Banner variant="danger">
          Never share your private key. Anyone with this key has full control of your wallet.
        </Banner>

        <Card>
          <p class="text-xs text-text-secondary">Account</p>
          <p class="text-sm font-semibold text-text-primary mt-0.5">{account.name}</p>
          <p class="text-xs font-mono text-text-primary/70 mt-0.5">
            {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </p>
        </Card>

        {!revealed ? (
          <>
            <Input
              label="Enter password to continue"
              type="password"
              placeholder="Password"
              value={password}
              onInput={(v) => { setPassword(v); setError(""); }}
              error={error}
              autoFocus
            />
            <Button onClick={handleReveal} size="lg">
              Reveal Private Key
            </Button>
          </>
        ) : (
          <div class="space-y-3">
            <Card>
              <div class="flex items-center justify-between mb-2">
                <p class="text-xs text-text-secondary">Private Key</p>
                <div class="flex items-center gap-1">
                  <button
                    onClick={() => setShowKey(!showKey)}
                    class="p-1 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <CopyButton text={MOCK_PRIVATE_KEY} size={14} />
                </div>
              </div>
              <p class="font-mono text-xs text-text-primary break-all leading-relaxed select-all">
                {showKey ? MOCK_PRIVATE_KEY : "•".repeat(66)}
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
