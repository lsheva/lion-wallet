/**
 * "API Keys" section: per-provider key (Alchemy RPC, Etherscan) inline
 * editor with masked display, dashboard link, and remove action.
 */
import { sendMessage } from "@shared/messages";
import { ChevronRight, ExternalLink, Key, X, Zap } from "lucide-solid";
import { createSignal, onMount } from "solid-js";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";

function ApiKeyRow(props: {
  icon: typeof Key;
  label: string;
  currentKey: string | null;
  dashboardUrl: string;
  dashboardLabel: string;
  onSave: (key: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const Icon = props.icon;
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const maskedKey = () =>
    props.currentKey ? `${props.currentKey.slice(0, 4)}${"\u2022".repeat(8)}` : "Not set";

  const handleSave = async () => {
    setSaving(true);
    await props.onSave(editValue().trim());
    setEditing(false);
    setSaving(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    await props.onRemove();
    setEditing(false);
    setEditValue("");
    setSaving(false);
  };

  return (
    <>
      {editing() ? (
        <div class="px-4 py-3 space-y-2">
          <Input
            label={props.label}
            placeholder="Paste your API key"
            value={editValue()}
            onInput={setEditValue}
            mono
            autoFocus
          />
          <a
            href={props.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors"
          >
            {props.dashboardLabel}
            <ExternalLink size={10} />
          </a>
          <div class="flex gap-2">
            <Button size="sm" onClick={handleSave} loading={saving()}>
              Save
            </Button>
            {props.currentKey && (
              <Button size="sm" variant="ghost" onClick={handleRemove} loading={saving()}>
                Remove
              </Button>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              class="ml-auto text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditValue(props.currentKey ?? "");
            setEditing(true);
          }}
          class="flex items-center justify-between w-full px-4 py-3 cursor-pointer text-left hover:bg-base/50 transition-colors"
        >
          <div class="flex items-center gap-2">
            <Icon size={16} class="text-text-tertiary" />
            <div>
              <p class="text-sm text-text-primary">{props.label}</p>
              <p class="text-xs font-mono text-text-tertiary">{maskedKey()}</p>
            </div>
          </div>
          <ChevronRight size={16} class="text-text-tertiary" />
        </button>
      )}
    </>
  );
}

export function ApiKeysSection() {
  const [alchemyKey, setAlchemyKey] = createSignal<string | null>(null);
  const [etherscanKey, setEtherscanKey] = createSignal<string | null>(null);

  onMount(() => {
    sendMessage({ type: "GET_RPC_PROVIDER_KEY" }).then((res) => {
      if (res.ok && res.data) {
        setAlchemyKey(res.data.key);
      }
    });
    sendMessage({ type: "GET_ETHERSCAN_KEY" }).then((res) => {
      if (res.ok && res.data) {
        setEtherscanKey(res.data.key);
      }
    });
  });

  return (
    <Card header="API Keys" padding={false}>
      <div class="divide-y divide-divider">
        <ApiKeyRow
          icon={Zap}
          label="Alchemy RPC Key"
          currentKey={alchemyKey()}
          dashboardUrl="https://dashboard.alchemy.com/"
          dashboardLabel="Get a key"
          onSave={async (key) => {
            await sendMessage({ type: "SET_RPC_PROVIDER_KEY", key });
            setAlchemyKey(key || null);
          }}
          onRemove={async () => {
            await sendMessage({ type: "SET_RPC_PROVIDER_KEY", key: "" });
            setAlchemyKey(null);
          }}
        />
        <ApiKeyRow
          icon={Key}
          label="Etherscan API Key"
          currentKey={etherscanKey()}
          dashboardUrl="https://etherscan.io/myapikey"
          dashboardLabel="Get a key"
          onSave={async (key) => {
            await sendMessage({ type: "SET_ETHERSCAN_KEY", key });
            setEtherscanKey(key || null);
          }}
          onRemove={async () => {
            await sendMessage({ type: "SET_ETHERSCAN_KEY", key: "" });
            setEtherscanKey(null);
          }}
        />
      </div>
    </Card>
  );
}
