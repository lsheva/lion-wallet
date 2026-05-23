/**
 * Balance + token info / price reads. No state mutations except for the side
 * effect of caching ERC-20 balances via `updateTokenBalances`.
 */
import type { Address } from "viem";
import { getBalance, readContract } from "viem/actions";
import { formatEther, formatUnits } from "viem/utils";
import { erc20Abi } from "../../../shared/abis";
import { formatProviderError } from "../../../shared/format";
import type { MessageResponse } from "../../../shared/messages";
import { getActiveAccount } from "../../account-utils";
import { fetchNativePrice } from "../../etherscan";
import { bgLog } from "../../log";
import { getActiveNetworkId, getNetworkConfig, getPublicClient } from "../../networks";
import { fetchNativePriceCoinGecko, fetchTokenPrice } from "../../prices";
import { fetchTokenMeta } from "../../token-meta";
import { updateTokenBalances } from "../../token-store";
import { loadAccountsMeta } from "../../vault";

export async function handleGetBalance(
  address: Address,
  chainId: number,
): Promise<MessageResponse> {
  const client = getPublicClient(chainId);
  const cfg = getNetworkConfig(chainId);
  const isTestnet = cfg?.testnet === true;
  try {
    const [balance, nativeUsdPrice] = await Promise.all([
      getBalance(client, { address }),
      isTestnet
        ? Promise.resolve(0)
        : fetchNativePrice(chainId).then((p) => p ?? fetchNativePriceCoinGecko(chainId)),
    ]);
    return { ok: true, data: { balance: formatEther(balance), nativeUsdPrice } };
  } catch (e) {
    const msg = formatProviderError(e);
    bgLog("[get-balance]", chainId, address, msg);
    return { ok: false, error: msg || "Could not load balance" };
  }
}

export async function handleGetTokenBalances(tokens: Address[]): Promise<MessageResponse> {
  const chainId = await getActiveNetworkId();
  const client = getPublicClient(chainId);
  const meta = await loadAccountsMeta();
  const account = meta ? getActiveAccount(meta) : undefined;
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const results = await Promise.all(
    tokens.map((token) =>
      readContract(client, {
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      }).catch(() => 0n),
    ),
  );

  const balances: Record<string, string> = {};
  for (const [i, token] of tokens.entries()) {
    balances[token] = String(results[i]);
  }

  updateTokenBalances(chainId, account.address, balances).catch(() => {});

  return { ok: true, data: { balances } };
}

export async function handleGetTokenPrice(
  address: Address,
  chainId: number,
): Promise<MessageResponse> {
  const cfg = getNetworkConfig(chainId);
  if (cfg?.testnet) return { ok: true, data: { price: null } };
  const price = await fetchTokenPrice(chainId, address);
  return { ok: true, data: { price } };
}

export async function handleGetTokenInfo(
  address: Address,
  chainId: number,
): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  const account = meta ? getActiveAccount(meta) : undefined;
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const tokenMeta = await fetchTokenMeta(chainId, address);
  if (tokenMeta.symbol === "???") {
    return { ok: false, error: "Could not read token contract" };
  }

  const client = getPublicClient(chainId);
  let balance = "0";
  try {
    const raw = await readContract(client, {
      address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    balance = formatUnits(raw, tokenMeta.decimals);
  } catch {
    /* balance read failed — return 0 */
  }

  return {
    ok: true,
    data: {
      name: tokenMeta.name,
      symbol: tokenMeta.symbol,
      decimals: tokenMeta.decimals,
      balance,
    },
  };
}
