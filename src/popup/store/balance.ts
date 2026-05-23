/**
 * Native + ERC-20 balance signals plus the multi-phase `fetchBalance` flow.
 *
 * Phases:
 * 0. Restore cached native balance from `localStorage` (zero RPC, instant).
 * 1. Read previously discovered tokens from background storage and show them
 *    with stale balances.
 * 2. Fetch real native + ERC-20 balances in parallel from the chain.
 * 3. Trigger an asynchronous token discovery scan + per-token USD prices.
 */
import { formatUsd, tokenColorFromAddress } from "@shared/format";
import { sendMessage } from "@shared/messages";
import type { StoredToken, TokenInfo } from "@shared/types";
import { batch, createSignal, untrack } from "solid-js";
import { type Address, zeroAddress } from "viem";
import { formatUnits } from "viem/utils";
import { showError } from "../toast";
import { activeAccount } from "./accounts";
import {
  loadNativeBalanceCache,
  loadTokenPrices,
  saveNativeBalanceCache,
  saveTokenPrices,
} from "./cache";
import { activeNetwork, activeNetworkId, chainColor } from "./network";

export const [ethBalance, setEthBalance] = createSignal("—");
/** Per-unit native token USD price; `0` on testnets; `null` if unavailable. */
export const [nativeUsdPrice, setNativeUsdPrice] = createSignal<number | null>(null);
export const [tokens, setTokens] = createSignal<TokenInfo[]>([]);
export const [balanceLoading, setBalanceLoading] = createSignal(true);

function tokenUsdValue(balance: string, price: number | undefined): string | undefined {
  if (price == null) return undefined;
  const bal = parseFloat(balance);
  if (Number.isNaN(bal) || bal === 0) return formatUsd(0);
  return formatUsd(bal * price);
}

function buildErc20Token(
  t: StoredToken,
  balance: string,
  _chainId: number,
  price: number | undefined,
): TokenInfo {
  return {
    symbol: t.symbol,
    name: t.name,
    address: t.address as Address,
    decimals: t.decimals,
    balance,
    color: tokenColorFromAddress(t.address),
    source: t.source,
    usdValue: tokenUsdValue(balance, price),
  };
}

function nativeBalanceUsdString(): string | undefined {
  const rate = untrack(nativeUsdPrice);
  const bal = parseFloat(untrack(ethBalance));
  if (Number.isNaN(bal) || rate == null) return "\u2014";
  if (rate === 0) return formatUsd(0);
  if (rate > 0) return formatUsd(bal * rate);
  return undefined;
}

export function buildNativeToken(): TokenInfo {
  const net = untrack(activeNetwork);
  return {
    symbol: net.nativeCurrency.symbol,
    name: net.nativeCurrency.name,
    decimals: net.nativeCurrency.decimals,
    balance: untrack(ethBalance),
    color: chainColor(net.id),
    usdValue: nativeBalanceUsdString(),
  };
}

function formatBalance(raw: string, decimals: number): string {
  try {
    return formatUnits(BigInt(raw), decimals);
  } catch {
    return "0";
  }
}

export async function fetchBalance(): Promise<void> {
  const account = untrack(activeAccount);
  if (!account.address || account.address === zeroAddress) return;
  const chainId = untrack(activeNetworkId);
  const address = account.address as Address;
  setBalanceLoading(true);

  // Phase 0: restore cached native balance from localStorage (no async, instant)
  const cachedNative = loadNativeBalanceCache(chainId, address);
  if (cachedNative) {
    batch(() => {
      setEthBalance(cachedNative.balance);
      setNativeUsdPrice(cachedNative.usdPrice);
    });
  }

  // Phase 1: show cached token list immediately (storage read, no RPC)
  const discoveredRes = await sendMessage({
    type: "GET_DISCOVERED_TOKENS",
    chainId,
    walletAddress: address,
  }).catch(() => null);

  const discovered: StoredToken[] =
    discoveredRes?.ok && discoveredRes.data?.tokens?.length ? discoveredRes.data.tokens : [];

  const cachedPrices = loadTokenPrices(chainId);

  if (discovered.length > 0) {
    const cached: TokenInfo[] = discovered.map((t) => {
      const balance = t.lastBalance ? formatBalance(t.lastBalance, t.decimals) : "—";
      return buildErc20Token(t, balance, chainId, cachedPrices[t.address.toLowerCase()]);
    });
    setTokens([buildNativeToken(), ...cached]);
  }

  // Phase 2: fetch real balances (native + ERC-20 in parallel)
  const tokenAddresses = discovered.map((t) => t.address as Address);
  const [balRes, tokBalRes] = await Promise.all([
    sendMessage({ type: "GET_BALANCE", address, chainId }),
    tokenAddresses.length > 0
      ? sendMessage({ type: "GET_TOKEN_BALANCES", tokens: tokenAddresses })
      : null,
  ]);

  if (balRes.ok && balRes.data) {
    setEthBalance(balRes.data.balance);
    setNativeUsdPrice(balRes.data.nativeUsdPrice);
    saveNativeBalanceCache(chainId, address, balRes.data.balance, balRes.data.nativeUsdPrice);
  } else if (!balRes.ok) {
    showError("Could not load balance", balRes.error);
  }

  const balances: Record<string, string> =
    tokBalRes?.ok && tokBalRes.data ? tokBalRes.data.balances : {};

  const erc20Tokens: TokenInfo[] = discovered.map((t) => {
    const balance = formatBalance(balances[t.address as Address] ?? "0", t.decimals);
    return buildErc20Token(t, balance, chainId, cachedPrices[t.address.toLowerCase()]);
  });

  setTokens([buildNativeToken(), ...erc20Tokens]);

  // Phase 3+4 run concurrently: token scan (RPC) and USD prices (CoinGecko)
  fetchTokenPrices(chainId);

  try {
    const scanRes = await sendMessage({ type: "SCAN_TOKENS", chainId, address });
    if (scanRes.ok && scanRes.data?.found > 0) {
      const freshRes = await sendMessage({
        type: "GET_DISCOVERED_TOKENS",
        chainId,
        walletAddress: address,
      }).catch(() => null);
      if (freshRes?.ok && freshRes.data?.tokens?.length) {
        const existingAddrs = new Set(discovered.map((d) => d.address));
        const newTokens: StoredToken[] = freshRes.data.tokens.filter(
          (t: StoredToken) => !existingAddrs.has(t.address),
        );
        if (newTokens.length > 0) {
          const newAddresses = newTokens.map((t) => t.address as Address);
          const newBalRes = await sendMessage({ type: "GET_TOKEN_BALANCES", tokens: newAddresses });
          const newBals: Record<string, string> =
            newBalRes.ok && newBalRes.data ? newBalRes.data.balances : {};
          const additions: TokenInfo[] = newTokens.map((t) => {
            const balance = formatBalance(newBals[t.address as Address] ?? "0", t.decimals);
            return buildErc20Token(t, balance, chainId, cachedPrices[t.address.toLowerCase()]);
          });
          setTokens((prev) => [...prev, ...additions]);
        }
      }
    }
  } catch {
    /* non-critical */
  } finally {
    setBalanceLoading(false);
  }
}

function fetchTokenPrices(chainId: number): void {
  const current = untrack(tokens);
  const erc20 = current.filter((t) => t.address);
  if (erc20.length === 0) return;

  for (const token of erc20) {
    const addr = token.address as Address;
    sendMessage({ type: "GET_TOKEN_PRICE", address: addr, chainId })
      .then((res) => {
        if (!res.ok || res.data.price == null) return;
        const price = res.data.price;
        saveTokenPrices(chainId, { [addr.toLowerCase()]: price });
        setTokens((prev) =>
          prev.map((t) =>
            t.address?.toLowerCase() === addr.toLowerCase()
              ? { ...t, usdValue: tokenUsdValue(t.balance, price) }
              : t,
          ),
        );
      })
      .catch(() => {});
  }
}

export async function hideToken(tokenAddress: Address): Promise<void> {
  const chainId = untrack(activeNetworkId);
  const walletAddress = untrack(activeAccount).address as Address;
  try {
    await sendMessage({
      type: "HIDE_DISCOVERED_TOKEN",
      chainId,
      walletAddress,
      address: tokenAddress,
    });
    setTokens(untrack(tokens).filter((t) => t.address !== tokenAddress));
  } catch {
    /* non-critical */
  }
}
