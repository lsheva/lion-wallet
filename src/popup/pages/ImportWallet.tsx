import { useState } from "preact/hooks";
import { route } from "preact-router";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Tabs } from "../components/Tabs";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { Clipboard } from "lucide-preact";
import { sendMessage } from "@shared/messages";
import { refreshAll } from "../store";

const TABS = [
  { id: "mnemonic", label: "Mnemonic" },
  { id: "privatekey", label: "Private Key" },
];

export function ImportWallet() {
  const [tab, setTab] = useState("mnemonic");
  const [mnemonic, setMnemonic] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    if (tab === "mnemonic") setMnemonic(text);
    else setPrivateKey(text);
  };

  const handleImport = async () => {
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

    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setError("");
    setLoading(true);

    let res;
    if (tab === "mnemonic") {
      res = await sendMessage({
        type: "IMPORT_WALLET",
        mnemonic: mnemonic.trim(),
        password,
      });
    } else {
      res = await sendMessage({
        type: "IMPORT_PRIVATE_KEY",
        privateKey: privateKey.trim() as `0x${string}`,
        password,
      });
    }

    setLoading(false);

    if (!res.ok) {
      setError((res as { error?: string }).error ?? "Import failed");
      return;
    }

    await refreshAll();
    route("/home");
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Import Wallet" onBack="/" />

      <div class="flex-1 px-4 pt-4 space-y-4 overflow-y-auto">
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
            autoFocus
          />
        ) : (
          <Input
            label="Private Key"
            placeholder="0x..."
            value={privateKey}
            onInput={(v) => { setPrivateKey(v); setError(""); }}
            mono
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

        <Input
          label="Password"
          type="password"
          placeholder="Set a password to encrypt your wallet"
          value={password}
          onInput={(v) => { setPassword(v); setError(""); }}
        />

        {error && <Banner variant="danger">{error}</Banner>}
      </div>

      <div class="px-4 py-4">
        <Button onClick={handleImport} size="lg" loading={loading}>
          Import
        </Button>
      </div>
    </div>
  );
}
