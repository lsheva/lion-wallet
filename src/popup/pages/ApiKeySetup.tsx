import { useState } from "preact/hooks";
import { route } from "preact-router";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Banner } from "../components/Banner";
import { ExternalLink, Key } from "lucide-preact";
import { sendMessage } from "@shared/messages";

export function ApiKeySetup() {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    const trimmed = apiKey.trim();
    if (trimmed && !/^[A-Za-z0-9]{20,40}$/.test(trimmed)) {
      setError("That doesn't look like a valid API key");
      return;
    }

    setSaving(true);
    try {
      if (trimmed) {
        await sendMessage({ type: "SET_ETHERSCAN_KEY", key: trimmed });
      }
      route("/home");
    } catch {
      setError("Failed to save — try again");
      setSaving(false);
    }
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Enhance Your Wallet" onBack={undefined} />

      <div class="flex-1 px-4 pt-4 space-y-4 overflow-y-auto">
        <Card>
          <div class="flex items-start gap-3">
            <Key size={20} class="text-accent shrink-0 mt-0.5" />
            <p class="text-sm text-text-secondary leading-relaxed">
              Add an Etherscan API key to unlock transaction decoding,
              contract verification, and live USD prices when reviewing
              transactions.
            </p>
          </div>
        </Card>

        <div class="space-y-3">
          <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider">How to get a key</p>
          <ol class="space-y-2.5 text-sm text-text-primary list-decimal list-inside">
            <li>
              Go to{" "}
              <a
                href="https://etherscan.io/myapikey"
                target="_blank"
                rel="noopener noreferrer"
                class="text-accent hover:text-accent-hover inline-flex items-center gap-0.5"
              >
                etherscan.io/myapikey
                <ExternalLink size={12} />
              </a>{" "}
              and create a free account
            </li>
            <li>Click <span class="font-semibold">Add</span> to generate a new API key</li>
            <li>Paste your key below</li>
          </ol>
        </div>

        <Input
          label="API Key"
          placeholder="Paste your Etherscan API key"
          value={apiKey}
          onInput={(v) => { setApiKey(v); setError(""); }}
          mono
          autoFocus
        />

        {error && <Banner variant="danger">{error}</Banner>}
      </div>

      <div class="px-4 py-4 space-y-2">
        <Button onClick={handleContinue} size="lg" loading={saving}>
          Continue
        </Button>
        <button
          type="button"
          onClick={() => route("/home")}
          class="w-full text-center text-sm text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer py-1"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
