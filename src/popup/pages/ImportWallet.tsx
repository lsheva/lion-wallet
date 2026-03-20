import { toErrorMessage } from "@shared/format";
import { type MessageResponse, sendMessage } from "@shared/messages";
import { Clipboard, Fingerprint } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { route } from "preact-router";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Tabs } from "../components/Tabs";
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
  const [keychainAvailable, setKeychainAvailable] = useState<boolean | null>(null);
  const [preferPassword, setPreferPassword] = useState(false);

  useEffect(() => {
    sendMessage({ type: "CHECK_KEYCHAIN_AVAILABLE" }).then((res) => {
      setKeychainAvailable(res.ok && (res.data as { available?: boolean })?.available === true);
    });
  }, []);

  const usePassword = keychainAvailable === false || preferPassword;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (tab === "mnemonic") setMnemonic(text);
      else setPrivateKey(text);
    } catch {
      setError("Clipboard access denied — please paste manually");
    }
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

    if (usePassword && password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setError("");
    setLoading(true);

    try {
      let res: MessageResponse | undefined;
      if (tab === "mnemonic") {
        res = await sendMessage({
          type: "IMPORT_WALLET",
          mnemonic: mnemonic.trim(),
          ...(usePassword ? { password } : {}),
        });
      } else {
        res = await sendMessage({
          type: "IMPORT_PRIVATE_KEY",
          privateKey: privateKey.trim() as `0x${string}`,
          ...(usePassword ? { password } : {}),
        });
      }

      if (!res || !res.ok) {
        const errMsg = res && "error" in res ? res.error : "Import failed";
        console.log("[ImportWallet] error:", errMsg);
        setError(errMsg);
        setLoading(false);
        return;
      }

      await refreshAll();
      route("/api-key-setup");
    } catch (e) {
      setError(toErrorMessage(e));
      setLoading(false);
    }
  };

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Import Wallet" onBack="/" />

      <div class="flex-1 px-4 pt-4 space-y-4 overflow-y-auto">
        <Tabs
          items={TABS}
          active={tab}
          onChange={(id) => {
            setTab(id);
            setError("");
          }}
        />

        {tab === "mnemonic" ? (
          <Input
            label="Recovery Phrase"
            placeholder="Enter your 12 or 24 word recovery phrase..."
            value={mnemonic}
            onInput={(v) => {
              setMnemonic(v);
              setError("");
            }}
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
            onInput={(v) => {
              setPrivateKey(v);
              setError("");
            }}
            mono
            autoFocus
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
        )}

        {usePassword && (
          <>
            {preferPassword && keychainAvailable && (
              <Banner variant="warning">
                Touch ID protects your keys with hardware-backed security. A password is less
                secure.
              </Banner>
            )}
            <Input
              label="Password"
              type="password"
              placeholder="Set a password to encrypt your wallet"
              value={password}
              onInput={(v) => {
                setPassword(v);
                setError("");
              }}
            />
          </>
        )}

        {keychainAvailable && (
          <button
            type="button"
            onClick={() => {
              setPreferPassword(!preferPassword);
              setError("");
            }}
            class="text-xs text-text-tertiary hover:text-accent transition-colors cursor-pointer"
          >
            {preferPassword ? "Use Touch ID instead" : "Use password instead"}
          </button>
        )}

        {error && <Banner variant="danger">{error}</Banner>}
      </div>

      <div class="px-4 py-4">
        <Button onClick={handleImport} size="lg" loading={loading}>
          {!usePassword ? (
            <span class="inline-flex items-center gap-1.5">
              <Fingerprint size={18} />
              Import
            </span>
          ) : (
            "Import"
          )}
        </Button>
      </div>
    </div>
  );
}
