import { sendMessage } from "@shared/messages";
import { Loader2 } from "lucide-solid";
import { batch, createSignal, Show } from "solid-js";
import type { Address } from "viem";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { fetchBalance, tokens, walletState } from "../store";

interface AddTokenProps {
  open: boolean;
  onClose: () => void;
}

interface DetectedToken {
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
}

async function fetchTokenInfo(address: string, chainId: number): Promise<DetectedToken> {
  const res = await sendMessage({
    type: "GET_TOKEN_INFO",
    address: address as Address,
    chainId,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export function AddToken(props: AddTokenProps) {
  const [address, setAddress] = createSignal("");
  const [detecting, setDetecting] = createSignal(false);
  const [detected, setDetected] = createSignal<DetectedToken | null>(null);
  const [error, setError] = createSignal("");

  let detectTimerRef: ReturnType<typeof setTimeout> | null = null;

  const handleAddressInput = (value: string) => {
    batch(() => {
      setAddress(value);
      setError("");
      setDetected(null);
    });

    if (detectTimerRef) clearTimeout(detectTimerRef);
    const trimmed = value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return;

    if (tokens().some((t) => t.address?.toLowerCase() === trimmed.toLowerCase())) {
      setError("Token already added");
      return;
    }

    detectTimerRef = setTimeout(async () => {
      setDetecting(true);
      try {
        const chainId = walletState.activeNetworkId();
        const info = await fetchTokenInfo(trimmed, chainId);
        setDetected(info);
      } catch {
        setError("Could not read token contract");
      } finally {
        setDetecting(false);
      }
    }, 300);
  };

  const handleAdd = async () => {
    const d = detected();
    if (!d) return;
    const trimmed = address().trim() as Address;
    const chainId = walletState.activeNetworkId();
    await sendMessage({ type: "ADD_MANUAL_TOKEN", address: trimmed, chainId, walletAddress: walletState.activeAccount().address as Address });
    await fetchBalance();
    handleClose();
  };

  const handleClose = () => {
    batch(() => {
      setAddress("");
      setDetected(null);
      setDetecting(false);
      setError("");
    });
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={handleClose} title="Add Token">
      <div class="px-4 py-3 space-y-4">
        <Input
          label="Token Contract Address"
          placeholder="0x..."
          value={address()}
          onInput={handleAddressInput}
          mono
          error={error()}
          autoFocus
        />

        <Show when={detecting()}>
          <div class="flex items-center gap-2 text-sm text-text-tertiary py-2">
            <Loader2 size={14} class="animate-spin text-accent" />
            Reading contract...
          </div>
        </Show>

        <Show when={detected()}>
          {(d) => (
            <div class="bg-base rounded-[var(--radius-card)] p-3 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs text-text-secondary">Name</span>
                <span class="text-sm font-medium text-text-primary">{d().name}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-text-secondary">Symbol</span>
                <span class="font-mono text-sm text-text-primary">{d().symbol}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-text-secondary">Decimals</span>
                <span class="font-mono text-sm text-text-primary">{d().decimals}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-text-secondary">Your balance</span>
                <span class="font-mono text-sm text-text-primary">{d().balance}</span>
              </div>
            </div>
          )}
        </Show>

        <Button onClick={handleAdd} disabled={!detected()} size="md">
          {detected() ? `Add ${detected()?.symbol}` : "Add Token"}
        </Button>
      </div>
    </Modal>
  );
}
