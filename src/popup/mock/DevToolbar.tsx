import type { ApprovalData } from "@shared/types";
import { useNavigate } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { setPendingApprovalData } from "../App";
import {
  MOCK_ACCOUNTS,
  MOCK_SEED_PHRASE,
  MOCK_SIGN_REQUEST,
  MOCK_TX_REQUEST,
  MOCK_TYPED_DATA_REQUEST,
} from "./data";
import { setStorageMode, storageMode, type WalletView, walletState } from "./state";

interface NavItem {
  label: string;
  path: string;
  view: WalletView;
  setup?: () => void;
}

function mockApproval(method: string, extra: Record<string, unknown> = {}): ApprovalData {
  return {
    approval: {
      id: crypto.randomUUID(),
      method,
      params: [],
      origin: (extra.origin as string) ?? "app.uniswap.org",
      timestamp: Date.now(),
      chainId: 1,
    },
    gasPresets:
      method.includes("send") || method.includes("sign")
        ? {
            slow: {
              gasLimit: "195000",
              maxFeePerGas: "25000000000",
              maxPriorityFeePerGas: "1000000000",
              estimatedCostWei: "4875000000000000",
              estimatedCostEth: "0.004875",
            },
            normal: {
              gasLimit: "195000",
              maxFeePerGas: "32000000000",
              maxPriorityFeePerGas: "1500000000",
              estimatedCostWei: "6240000000000000",
              estimatedCostEth: "0.00624",
            },
            fast: {
              gasLimit: "195000",
              maxFeePerGas: "45000000000",
              maxPriorityFeePerGas: "2500000000",
              estimatedCostWei: "8775000000000000",
              estimatedCostEth: "0.008775",
            },
            baseFeeGwei: "24",
          }
        : null,
    account: {
      name: MOCK_ACCOUNTS[0]!.name,
      address: MOCK_ACCOUNTS[0]!.address as `0x${string}`,
      path: MOCK_ACCOUNTS[0]!.path,
      index: 0,
    },
    queueSize: 1,
    storageMode: storageMode(),
    ...extra,
  };
}

const GROUPS: Array<{ name: string; items: NavItem[] }> = [
  {
    name: "Onboarding",
    items: [
      { label: "Welcome", path: "/", view: "onboarding" },
      { label: "SetPwd", path: "/set-password", view: "onboarding" },
      {
        label: "Seed",
        path: "/seed-phrase",
        view: "onboarding",
        setup: () => {
          sessionStorage.setItem("onboarding_mnemonic", MOCK_SEED_PHRASE.join(" "));
        },
      },
      {
        label: "Confirm",
        path: "/confirm-seed",
        view: "onboarding",
        setup: () => {
          sessionStorage.setItem("onboarding_mnemonic", MOCK_SEED_PHRASE.join(" "));
        },
      },
      { label: "Import", path: "/import", view: "onboarding" },
      { label: "API Key", path: "/api-key-setup", view: "onboarding" },
    ],
  },
  {
    name: "Main",
    items: [
      { label: "Home", path: "/home", view: "home" },
      { label: "Send", path: "/send", view: "home" },
      { label: "Receive", path: "/receive", view: "home" },
      { label: "Settings", path: "/settings", view: "home" },
      { label: "Export", path: "/export-key", view: "home" },
      { label: "Phrase", path: "/show-phrase", view: "home" },
    ],
  },
  {
    name: "Approval",
    items: [
      {
        label: "Tx",
        path: "/approve",
        view: "approval",
        setup: () => {
          setPendingApprovalData(
            mockApproval("eth_sendTransaction", {
              decoded: MOCK_TX_REQUEST.decoded,
              transfers: MOCK_TX_REQUEST.transfers,
              nativeUsdPrice: 2385,
            }),
          );
        },
      },
      {
        label: "Sign",
        path: "/approve",
        view: "approval",
        setup: () => {
          setPendingApprovalData(
            mockApproval("personal_sign", {
              origin: MOCK_SIGN_REQUEST.origin,
            }),
          );
        },
      },
      {
        label: "Typed",
        path: "/approve",
        view: "approval",
        setup: () => {
          setPendingApprovalData(
            mockApproval("eth_signTypedData_v4", {
              origin: MOCK_TYPED_DATA_REQUEST.origin,
            }),
          );
        },
      },
      {
        label: "TX OK",
        path: "/tx-success",
        view: "approval",
        setup: () => {
          sessionStorage.setItem(
            "txResult",
            JSON.stringify({
              hash: "0xabc123def456789012345678901234567890123456789012345678901234abcd",
              method: "eth_sendTransaction",
            }),
          );
        },
      },
      {
        label: "TX Fail",
        path: "/tx-error",
        view: "approval",
        setup: () => {
          sessionStorage.setItem(
            "txResult",
            JSON.stringify({ error: "Execution reverted: insufficient funds for transfer" }),
          );
        },
      },
      {
        label: "Sig OK",
        path: "/sign-success",
        view: "approval",
        setup: () => {
          sessionStorage.setItem(
            "signResult",
            JSON.stringify({
              signature:
                "0x4a7f8c2e9b1d3f5a6c8e0b2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e2d4f6a8c01b",
            }),
          );
        },
      },
      {
        label: "Sig Fail",
        path: "/sign-error",
        view: "approval",
        setup: () => {
          sessionStorage.setItem(
            "signResult",
            JSON.stringify({ error: "User rejected the signing request" }),
          );
        },
      },
    ],
  },
];

export function DevToolbar() {
  const [expanded, setExpanded] = createSignal(false);
  const navigate = useNavigate();

  return (
    <div class="fixed bottom-0 left-1/2 -translate-x-1/2 z-50" style={{ width: "360px" }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded())}
        class="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px] text-white/60 bg-[#1C1C1E]/80 rounded-t cursor-pointer hover:text-white/90"
      >
        {expanded() ? "▼ Dev" : "▲ Dev"}
      </button>

      <Show when={expanded()}>
        <div class="bg-[#1C1C1E]/90 backdrop-blur rounded-t-lg px-2 py-1.5 space-y-1">
          <For each={GROUPS}>
            {(group) => (
              <div class="flex flex-wrap items-center gap-0.5">
                <span class="text-[8px] text-white/40 uppercase tracking-wider w-full">
                  {group.name}
                </span>
                <For each={group.items}>
                  {(item) => (
                    <button
                      type="button"
                      onClick={() => {
                        item.setup?.();
                        walletState.setView(item.view);
                        navigate(item.path, { replace: true });
                      }}
                      class="px-1.5 py-0.5 text-[10px] text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {item.label}
                    </button>
                  )}
                </For>
              </div>
            )}
          </For>
          <div class="flex items-center gap-2 pt-0.5 border-t border-white/10">
            <span class="text-[8px] text-white/40 uppercase tracking-wider">Auth</span>
            <button
              type="button"
              onClick={() => {
                setStorageMode(storageMode() === "keychain" ? "vault" : "keychain");
              }}
              class={`px-1.5 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
                storageMode() === "keychain"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {storageMode() === "keychain" ? "Touch ID" : "Password"}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
