import { useState } from "preact/hooks";
import { route } from "preact-router";
import { Shield } from "lucide-preact";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { walletState } from "../store";

export function Unlock() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("Wrong password");
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (password.length < 4) {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
      return;
    }

    setLoading(true);
    const res = await walletState.unlock(password);
    setLoading(false);

    if (!res.ok) {
      setError(true);
      setErrorMsg(res.error ?? "Wrong password");
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
      return;
    }

    route("/home");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleUnlock();
  };

  return (
    <div class="flex flex-col items-center justify-center h-[600px] px-4" onKeyDown={handleKeyDown}>
      <div class="relative mb-8">
        <div class="absolute inset-0 bg-accent/20 rounded-full blur-2xl scale-150" />
        <div class="relative w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-lg">
          <Shield size={32} class="text-white" />
        </div>
      </div>

      <div class={`w-full ${shaking ? "animate-shake" : ""}`}>
        <Input
          type="password"
          placeholder="Enter password"
          value={password}
          onInput={(v) => { setPassword(v); setError(false); }}
          error={error ? errorMsg : undefined}
          autoFocus
        />
      </div>

      <div class="w-full mt-4">
        <Button onClick={handleUnlock} size="lg" loading={loading}>Unlock</Button>
      </div>

      <button
        onClick={() => route("/import")}
        class="mt-6 text-xs text-text-tertiary hover:text-accent transition-colors cursor-pointer"
      >
        Forgot password? Import again
      </button>
    </div>
  );
}
