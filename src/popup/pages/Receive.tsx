import { useEffect, useRef, useState } from "preact/hooks";
import { encode } from "uqr";
import { AddressDisplay } from "../components/AddressDisplay";
import { Banner } from "../components/Banner";
import { Header } from "../components/Header";
import { NetworkBadge } from "../components/NetworkBadge";
import { walletState } from "../store";

const QR_SIZE = 200;
const QR_MARGIN = 2;
const QR_DARK = "#1C1C1E";
const QR_LIGHT = "#FFFFFF";

function renderQR(canvas: HTMLCanvasElement, data: string) {
  const { data: grid, size } = encode(data);
  const total = size + QR_MARGIN * 2;
  const scale = QR_SIZE / total;

  canvas.width = QR_SIZE;
  canvas.height = QR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = QR_LIGHT;
  ctx.fillRect(0, 0, QR_SIZE, QR_SIZE);

  ctx.fillStyle = QR_DARK;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y * size + x]) {
        ctx.fillRect((x + QR_MARGIN) * scale, (y + QR_MARGIN) * scale, scale, scale);
      }
    }
  }
}

export function Receive() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const address = walletState.activeAccount.value.address;
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      try {
        renderQR(canvasRef.current, address);
      } catch {
        setQrError(true);
      }
    }
  }, [address]);

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Receive" onBack="/home" />

      <div class="flex-1 flex flex-col items-center justify-center px-4">
        {qrError && <Banner variant="danger">Failed to generate QR code</Banner>}
        <div class="bg-surface rounded-2xl p-5 shadow-sm">
          <canvas ref={canvasRef} class="rounded-lg" />
        </div>

        <div class="mt-5">
          <AddressDisplay address={address} full />
        </div>

        <div class="mt-4">
          <NetworkBadge clickable={false} />
        </div>
      </div>
    </div>
  );
}
