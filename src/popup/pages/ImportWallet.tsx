import { useState } from "preact/hooks";
import { route } from "preact-router";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Tabs } from "../components/Tabs";
import { Button } from "../components/Button";
import { Clipboard } from "lucide-preact";
import { walletState } from "../mock/state";

const TABS = [
  { id: "mnemonic", label: "Mnemonic" },
  { id: "privatekey", label: "Private Key" },
];

export function ImportWallet() {
  const [tab, setTab] = useState("mnemonic");
  const [mnemonic, setMnemonic] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState("");

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    if (tab === "mnemonic") setMnemonic(text);
    else setPrivateKey(text);
  };

  const handleImport = () => {
    if (tab === "mnemonic") {
      const words = mnemonic.trim().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        setError("Enter a valid 12 or 24 word recovery phrase");
        return;
      }
    } else {
      if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey.trim())) {
        setError("Enter a valid private key (0x + 64 hex characters)");
        return;
      }
    }
    setError("");
    walletState.unlock();
    route("/home");
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Import Wallet" onBack="/" />

      <div class="flex-1 px-4 pt-4 space-y-4">
        <Tabs items={TABS} active={tab} onChange={(id) => { setTab(id); setError(""); }} />

        {tab === "mnemonic" ? (
          <Input
            label="Recovery Phrase"
            placeholder="Enter your 12 or 24 word recovery phrase..."
            value={mnemonic}
            onInput={(v) => { setMnemonic(v); setError(""); }}
            multiline
            rows={4}
            mono
            error={error}
            autoFocus
          />
        ) : (
          <Input
            label="Private Key"
            placeholder="0x..."
            value={privateKey}
            onInput={(v) => { setPrivateKey(v); setError(""); }}
            mono
            error={error}
            autoFocus
            rightSlot={
              <button
                onClick={handlePaste}
                class="text-text-tertiary hover:text-accent transition-colors cursor-pointer"
              >
                <Clipboard size={16} />
              </button>
            }
          />
        )}
      </div>

      <div class="px-4 py-4">
        <Button onClick={handleImport} size="lg">Import</Button>
      </div>
    </div>
  );
}
