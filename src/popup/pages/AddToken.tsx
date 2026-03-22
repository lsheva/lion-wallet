import { sendMessage } from "@shared/messages";
import { Loader2 } from "lucide-preact";
import { useCallback, useRef, useState } from "preact/hooks";
import type { Address } from "viem";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { tokens, walletState } from "../store";

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

function randomColor(): string {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 55%, 50%)`;
}

export function AddToken({ open, onClose }: AddTokenProps) {
  const [address, setAddress] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedToken | null>(null);
  const [error, setError] = useState("");

  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAddressInput = useCallback((value: string) => {
    setAddress(value);
    setError("");
    setDetected(null);

    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    const trimmed = value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return;

    if (tokens.value.some((t) => t.address?.toLowerCase() === trimmed.toLowerCase())) {
      setError("Token already added");
      return;
    }

    detectTimerRef.current = setTimeout(async () => {
      setDetecting(true);
      try {
        const chainId = walletState.activeNetworkId.value;
        const info = await fetchTokenInfo(trimmed, chainId);
        setDetected(info);
      } catch {
        setError("Could not read token contract");
      } finally {
        setDetecting(false);
      }
    }, 300);
  }, []);

  const handleAdd = () => {
    if (!detected) return;
    tokens.value = [
      ...tokens.value,
      {
        symbol: detected.symbol,
        name: detected.name,
        balance: detected.balance,
        usdValue: "--",
        color: randomColor(),
        address: address.trim() as `0x${string}`,
        decimals: detected.decimals,
      },
    ];
    handleClose();
  };

  const handleClose = () => {
    setAddress("");
    setDetected(null);
    setDetecting(false);
    setError("");
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add Token">
      <div class="px-4 py-3 space-y-4">
        <Input
          label="Token Contract Address"
          placeholder="0x..."
          value={address}
          onInput={handleAddressInput}
          mono
          error={error}
          autoFocus
        />

        {detecting && (
          <div class="flex items-center gap-2 text-sm text-text-tertiary py-2">
            <Loader2 size={14} class="animate-spin text-accent" />
            Reading contract...
          </div>
        )}

        {detected && (
          <div class="bg-base rounded-[var(--radius-card)] p-3 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs text-text-secondary">Name</span>
              <span class="text-sm font-medium text-text-primary">{detected.name}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-text-secondary">Symbol</span>
              <span class="font-mono text-sm text-text-primary">{detected.symbol}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-text-secondary">Decimals</span>
              <span class="font-mono text-sm text-text-primary">{detected.decimals}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-text-secondary">Your balance</span>
              <span class="font-mono text-sm text-text-primary">{detected.balance}</span>
            </div>
          </div>
        )}

        <Button onClick={handleAdd} disabled={!detected} size="md">
          {detected ? `Add ${detected.symbol}` : "Add Token"}
        </Button>
      </div>
    </Modal>
  );
}
