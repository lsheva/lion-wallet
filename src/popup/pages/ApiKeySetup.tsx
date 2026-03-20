import { sendMessage } from "@shared/messages";
import { ChevronDown, ChevronUp, ExternalLink, Search, Zap } from "lucide-preact";
import { useState } from "preact/hooks";
import { route } from "preact-router";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header } from "../components/Header";
import { Input } from "../components/Input";

const KEY_REGEX = /^[A-Za-z0-9_-]{20,40}$/;

function HelpAccordion({
  open,
  onToggle,
  steps,
}: {
  open: boolean;
  onToggle: () => void;
  steps: Array<{ text: string; href?: string }>;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        class="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
      >
        <span>Need a key?</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <ol class="mt-2 space-y-1.5 text-xs text-text-secondary list-decimal list-inside">
          {steps.map((step, i) => (
            <li key={i}>
              {step.href ? (
                <a
                  href={step.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-accent hover:text-accent-hover inline-flex items-center gap-0.5"
                >
                  {step.text}
                  <ExternalLink size={10} />
                </a>
              ) : (
                step.text
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ApiKeySetup() {
  const [alchemyKey, setAlchemyKey] = useState("");
  const [etherscanKey, setEtherscanKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [helpOpen, setHelpOpen] = useState<"alchemy" | "etherscan" | null>(null);

  const handleContinue = async () => {
    const alchemy = alchemyKey.trim();
    const etherscan = etherscanKey.trim();

    if (alchemy && !KEY_REGEX.test(alchemy)) {
      setError("Alchemy key doesn't look valid");
      return;
    }
    if (etherscan && !KEY_REGEX.test(etherscan)) {
      setError("Etherscan key doesn't look valid");
      return;
    }

    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [];
      if (alchemy) promises.push(sendMessage({ type: "SET_RPC_PROVIDER_KEY", key: alchemy }));
      if (etherscan) promises.push(sendMessage({ type: "SET_ETHERSCAN_KEY", key: etherscan }));
      await Promise.all(promises);
      route("/home");
    } catch {
      setError("Failed to save — try again");
      setSaving(false);
    }
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Enhance Your Wallet" onBack={undefined} />

      <div class="flex-1 px-4 pt-4 space-y-3 overflow-y-auto">
        <p class="text-sm text-text-secondary">Optional API keys for better speed and features.</p>

        <Card>
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Zap size={16} class="text-accent shrink-0" />
              <div>
                <p class="text-sm font-semibold text-text-primary">RPC Provider</p>
                <p class="text-xs text-text-tertiary">Faster, more reliable blockchain access</p>
              </div>
            </div>

            <Input
              placeholder="Paste Alchemy API key"
              value={alchemyKey}
              onInput={(v) => {
                setAlchemyKey(v);
                setError("");
              }}
              mono
            />

            <HelpAccordion
              open={helpOpen === "alchemy"}
              onToggle={() => setHelpOpen(helpOpen === "alchemy" ? null : "alchemy")}
              steps={[
                { text: "Open Alchemy Dashboard", href: "https://dashboard.alchemy.com/" },
                { text: "Sign up for a free account" },
                { text: "Create an app, then copy the API key" },
              ]}
            />
          </div>
        </Card>

        <Card>
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Search size={16} class="text-accent shrink-0" />
              <div>
                <p class="text-sm font-semibold text-text-primary">Block Explorer</p>
                <p class="text-xs text-text-tertiary">Transaction decoding and USD prices</p>
              </div>
            </div>

            <Input
              placeholder="Paste Etherscan API key"
              value={etherscanKey}
              onInput={(v) => {
                setEtherscanKey(v);
                setError("");
              }}
              mono
            />

            <HelpAccordion
              open={helpOpen === "etherscan"}
              onToggle={() => setHelpOpen(helpOpen === "etherscan" ? null : "etherscan")}
              steps={[
                { text: "Open Etherscan", href: "https://etherscan.io/myapikey" },
                { text: "Create a free account" },
                { text: "Click Add to generate a key" },
              ]}
            />
          </div>
        </Card>

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
