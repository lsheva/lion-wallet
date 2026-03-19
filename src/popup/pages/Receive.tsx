import { useEffect, useRef } from "preact/hooks";
import QRCode from "qrcode";
import { Header } from "../components/Header";
import { AddressDisplay } from "../components/AddressDisplay";
import { NetworkBadge } from "../components/NetworkBadge";
import { walletState } from "../mock/state";

export function Receive() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const address = walletState.activeAccount.value.address;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, address, {
        width: 200,
        margin: 2,
        color: { dark: "#1C1C1E", light: "#FFFFFF" },
      });
    }
  }, [address]);

  return (
    <div class="flex flex-col h-[600px]">
      <Header title="Receive" onBack="/home" />

      <div class="flex-1 flex flex-col items-center justify-center px-6">
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
