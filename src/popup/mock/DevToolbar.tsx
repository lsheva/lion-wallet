import { route } from "preact-router";
import { walletState, type WalletView } from "./state";

const NAV_ITEMS: { label: string; path: string; view: WalletView }[] = [
  { label: "Welcome", path: "/", view: "onboarding" },
  { label: "Home", path: "/home", view: "home" },
  { label: "Approve", path: "/approve", view: "approval" },
  { label: "TX OK", path: "/tx-success", view: "approval" },
  { label: "TX Fail", path: "/tx-error", view: "approval" },
  { label: "Sig OK", path: "/sign-success", view: "approval" },
  { label: "Sig Fail", path: "/sign-error", view: "approval" },
  { label: "Settings", path: "/settings", view: "home" },
];

export function DevToolbar() {
  return (
    <div
      class="fixed bottom-0 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-1 px-2 py-1.5 bg-[#1C1C1E]/90 backdrop-blur rounded-t-lg z-50"
      style={{ width: 360 }}
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.path}
          onClick={() => {
            walletState.setView(item.view);
            route(item.path);
          }}
          class="px-1.5 py-1 text-[10px] text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer whitespace-nowrap"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
