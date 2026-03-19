import { route } from "preact-router";
import { Button } from "../components/Button";
import { Shield } from "lucide-preact";

export function Welcome() {
  return (
    <div class="flex flex-col items-center justify-center h-[600px] px-4">
      <div class="relative mb-6">
        <div class="absolute inset-0 bg-accent/20 rounded-full blur-2xl scale-150" />
        <div class="relative w-20 h-20 bg-accent rounded-2xl flex items-center justify-center shadow-lg">
          <Shield size={40} class="text-white" />
        </div>
      </div>

      <h1 class="text-xl font-bold text-text-primary mb-1">Safari EVM Wallet</h1>
      <p class="text-sm text-text-secondary mb-10">Your keys. Your crypto.</p>

      <div class="w-full space-y-3">
        <Button onClick={() => route("/set-password")} size="lg">
          Create New Wallet
        </Button>
        <Button variant="secondary" onClick={() => route("/import")} size="lg">
          Import Existing
        </Button>
      </div>
    </div>
  );
}
