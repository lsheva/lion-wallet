import { signal, computed } from "@preact/signals";
import { sendMessage } from "@shared/messages";
import { NETWORKS } from "@shared/constants";
import type { SerializedAccount, NetworkConfig, TokenInfo } from "@shared/types";
import type { Address } from "viem";

export type { TokenInfo as Token };

export const accounts = signal<SerializedAccount[]>([]);
export const activeAccountIndex = signal(0);
export const activeNetworkId = signal(1);
export const showNetworkSelector = signal(false);
export const ethBalance = signal("0");
export const tokens = signal<TokenInfo[]>([]);
export const networks = signal<NetworkConfig[]>(NETWORKS);

export const activeAccount = computed(() =>
  accounts.value[activeAccountIndex.value] ?? {
    name: "Account 1",
    address: "0x0000000000000000000000000000000000000000" as Address,
    path: "m/44'/60'/0'/0/0",
    index: 0,
  },
);

export const activeNetwork = computed(
  () =>
    networks.value.find((n) => n.id === activeNetworkId.value) ??
    networks.value[0],
);

export const totalBalanceUsd = computed(() => {
  const bal = parseFloat(ethBalance.value);
  if (isNaN(bal) || bal === 0) return "$0.00";
  return `${bal.toFixed(4)} ${activeNetwork.value.symbol}`;
});

function buildNativeToken(): TokenInfo {
  const net = activeNetwork.peek();
  return {
    symbol: net.symbol,
    name: net.name,
    decimals: 18,
    balance: ethBalance.peek(),
    color: net.color,
  };
}

export async function fetchState(): Promise<void> {
  const res = await sendMessage({ type: "GET_STATE" });
  if (!res.ok || !res.data) return;
  const state = res.data as {
    accounts: SerializedAccount[];
    activeAccountIndex: number;
    activeNetworkId: number;
    isUnlocked: boolean;
  };
  accounts.value = state.accounts;
  activeAccountIndex.value = state.activeAccountIndex;
  activeNetworkId.value = state.activeNetworkId;
}

export async function fetchBalance(): Promise<void> {
  const account = activeAccount.peek();
  if (!account.address || account.address === "0x0000000000000000000000000000000000000000")
    return;
  const res = await sendMessage({
    type: "GET_BALANCE",
    address: account.address as Address,
    chainId: activeNetworkId.peek(),
  });
  if (res.ok && res.data) {
    ethBalance.value = (res.data as { balance: string }).balance;
    tokens.value = [buildNativeToken(), ...tokens.value.filter((t) => t.address)];
  }
}

export async function refreshAll(): Promise<void> {
  await fetchState();
  await fetchBalance();
}

export const walletState = {
  activeAccount,
  activeNetwork,
  activeAccountIndex,
  activeNetworkId,
  accounts,
  tokens,
  networks,
  totalBalanceUsd,
  ethBalance,
  showNetworkSelector,

  async unlock(password: string): Promise<{ ok: boolean; error?: string }> {
    const res = await sendMessage({ type: "UNLOCK", password });
    if (res.ok) {
      await fetchState();
      await fetchBalance();
    }
    return res.ok ? { ok: true } : { ok: false, error: (res as { error?: string }).error };
  },

  async lock(): Promise<void> {
    await sendMessage({ type: "LOCK" });
    accounts.value = [];
    ethBalance.value = "0";
    tokens.value = [];
  },

  async switchNetwork(id: number): Promise<void> {
    activeNetworkId.value = id;
    showNetworkSelector.value = false;
    try {
      await sendMessage({ type: "SWITCH_NETWORK", chainId: id });
    } catch (e) {
      console.warn("[store] switchNetwork message failed:", e);
    }
    await fetchBalance();
  },

  async switchAccount(index: number): Promise<void> {
    activeAccountIndex.value = index;
    try {
      await sendMessage({ type: "SWITCH_ACCOUNT", accountIndex: index });
    } catch (e) {
      console.warn("[store] switchAccount message failed:", e);
    }
    await fetchBalance();
  },

  renameAccount(index: number, newName: string) {
    accounts.value = accounts.value.map((acc, i) =>
      i === index ? { ...acc, name: newName } : acc,
    );
  },

  async addAccount(): Promise<void> {
    const res = await sendMessage({ type: "ADD_ACCOUNT" });
    if (res.ok) {
      await fetchState();
    }
  },
};
