import type { Address, Hex } from "viem";
import { getBalance, readContract } from "viem/actions";
import { encodeFunctionData, formatEther, formatUnits, numberToHex, parseUnits } from "viem/utils";
import { erc20Abi, feedFaceDisperseAbi } from "../../shared/abis";
import type { MessageResponse } from "../../shared/messages";
import type { MultiSendEntry, SerializedAccount, WalletState } from "../../shared/types";
import { runChainDiscovery } from "../chain-discovery";
import { broadcastEvent } from "../broadcast";
import {
  clearHdDerivedAddresses,
  deriveHdAddressList,
  resolveHdAddressList,
  saveHdDerivedAddresses,
} from "../hd-addresses";
import { clearConnectedOrigins } from "../connected-origins";
import { fetchNativePrice } from "../etherscan";
import * as keychain from "../keychain";
import { bgLog } from "../log";
import {
  getActiveNetworkId,
  getNetworkConfig,
  getPublicClient,
  setActiveNetworkId,
} from "../networks";
import { fetchNativePriceCoinGecko, fetchTokenPrice } from "../prices";
import { fetchTokenMeta } from "../token-meta";
import { updateTokenBalances } from "../token-store";
import {
  clearVault,
  decryptVault,
  encryptVault,
  getStorageMode,
  isVaultInitialized,
  loadAccountsMeta,
  type StorageMode,
  saveAccountsMeta,
  setStorageMode,
} from "../vault";
import * as wallet from "../wallet";

export async function retrieveMnemonic(
  mode: StorageMode,
  password?: string,
  reason?: string,
): Promise<string> {
  if (mode === "keychain") {
    const mnemonic = await keychain.retrieveMnemonic(reason);
    if (!mnemonic) throw new Error("Authentication failed or cancelled");
    return mnemonic;
  }
  if (!password) throw new Error("Password required");
  const data = await decryptVault(password);
  return data.mnemonic;
}

export async function retrieveImportedKey(
  mode: StorageMode,
  address: Address,
  password?: string,
  reason?: string,
): Promise<Hex | null> {
  if (mode === "keychain") {
    return keychain.retrieveImportedKey(address, reason);
  }
  if (!password) return null;
  const data = await decryptVault(password);
  if (!data.importedKeys) return null;
  return (data.importedKeys[address.toLowerCase()] as Hex) ?? null;
}

interface PersistOpts {
  mnemonic: string;
  accounts: SerializedAccount[];
  password?: string;
  importedKeys?: Record<string, string>;
  label: string;
}

async function persistWalletData({
  mnemonic,
  accounts,
  password,
  importedKeys,
  label,
}: PersistOpts): Promise<MessageResponse> {
  if (!password) {
    const probe = await keychain.isKeychainAvailable();
    bgLog(`[${label}] probe:`, JSON.stringify(probe));
    if (!probe.available) {
      return {
        ok: false,
        error: `Keychain not available: ${probe.error ?? "probe returned false"}`,
      };
    }

    const mnemonicRes = await keychain.storeMnemonic(mnemonic);
    bgLog(`[${label}] storeMnemonic:`, JSON.stringify(mnemonicRes));
    if (!mnemonicRes.ok) {
      return { ok: false, error: `Keychain store failed: ${mnemonicRes.error}` };
    }

    if (importedKeys) {
      for (const [addr, pk] of Object.entries(importedKeys)) {
        const keyRes = await keychain.storeImportedKey(addr as Address, pk as `0x${string}`);
        bgLog(`[${label}] storeKey(${addr}):`, JSON.stringify(keyRes));
        if (!keyRes.ok) {
          return { ok: false, error: `Keychain store failed: key: ${keyRes.error}` };
        }
      }
    }

    await setStorageMode("keychain");
  } else {
    await setStorageMode("vault");
    await encryptVault(
      { mnemonic, accounts, activeAccountIndex: 0, ...(importedKeys ? { importedKeys } : {}) },
      password,
    );
  }

  await saveAccountsMeta(accounts, 0);
  if (!importedKeys) {
    await saveHdDerivedAddresses(deriveHdAddressList(mnemonic));
  } else {
    await clearHdDerivedAddresses();
  }
  broadcastEvent(
    "accountsChanged",
    accounts.map((a) => a.address),
  );
  return { ok: true };
}

async function getWalletState(): Promise<WalletState> {
  const meta = await loadAccountsMeta();
  const mode = await getStorageMode();
  return {
    isInitialized: await isVaultInitialized(),
    storageMode: mode,
    accounts: meta?.accounts ?? [],
    activeAccountIndex: meta?.activeAccountIndex ?? 0,
    activeNetworkId: await getActiveNetworkId(),
  };
}

export async function handleCreateWallet(password?: string): Promise<MessageResponse> {
  const mnemonic = wallet.createMnemonic();
  const accounts = [wallet.deriveAccount(mnemonic, 0)];
  const res = await persistWalletData({ mnemonic, accounts, password, label: "create" });
  if (!res.ok) return res;
  return { ok: true, data: { mnemonic, accounts } };
}

export async function handleImportWallet(
  mnemonic: string,
  password?: string,
): Promise<MessageResponse> {
  const accounts = [wallet.deriveAccount(mnemonic, 0)];
  const res = await persistWalletData({ mnemonic, accounts, password, label: "import" });
  if (!res.ok) return res;
  return { ok: true, data: { accounts } };
}

export async function handleImportPrivateKey(
  privateKey: Hex,
  password?: string,
): Promise<MessageResponse> {
  const address = wallet.importFromPrivateKey(privateKey);
  const mnemonic = wallet.createMnemonic();
  const imported: SerializedAccount = {
    name: "Imported Account",
    address,
    path: "imported",
    index: 0,
  };
  const accounts = [imported];
  const res = await persistWalletData({
    mnemonic,
    accounts,
    password,
    importedKeys: { [address.toLowerCase()]: privateKey },
    label: "importKey",
  });
  if (!res.ok) return res;
  return { ok: true, data: { accounts } };
}

export async function handleGetState(): Promise<MessageResponse> {
  return { ok: true, data: await getWalletState() };
}

export async function handleGetAccounts(): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  return { ok: true, data: { accounts: meta?.accounts ?? [] } };
}

export async function handleAddAccount(password?: string): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const meta = await loadAccountsMeta();
  if (!meta) return { ok: false, error: "Wallet not initialized" };

  const mnemonic = await retrieveMnemonic(mode, password, "Derive a new account");
  const hdIndices = meta.accounts.filter((a) => a.path !== "imported").map((a) => a.index);
  const nextIndex = hdIndices.length > 0 ? Math.max(...hdIndices) + 1 : 0;
  const account = wallet.deriveAccount(mnemonic, nextIndex);
  const updatedAccounts = [...meta.accounts, account];

  await saveAccountsMeta(updatedAccounts, meta.activeAccountIndex);

  if (mode === "vault") {
    if (!password) return { ok: false, error: "Password required to persist account" };
    await encryptVault(
      { mnemonic, accounts: updatedAccounts, activeAccountIndex: meta.activeAccountIndex },
      password,
    );
  }

  broadcastEvent(
    "accountsChanged",
    updatedAccounts.map((a) => a.address),
  );
  return { ok: true, data: { account } };
}

export async function handleEnsureChainDiscovery(chainId: number): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  if (!meta?.accounts.length) return { ok: false, error: "Wallet not initialized" };

  if (meta.accounts.every((a) => a.path === "imported")) {
    return { ok: true, data: { activeAccountIndices: [0], scannedAt: Date.now() } };
  }

  let hdAddresses = await resolveHdAddressList(meta);
  if (!hdAddresses) {
    try {
      const mode = await getStorageMode();
      const mnemonic = await retrieveMnemonic(mode, undefined, "Discover accounts");
      hdAddresses = deriveHdAddressList(mnemonic);
      await saveHdDerivedAddresses(hdAddresses);
    } catch {
      hdAddresses = null;
    }
  }

  try {
    const data = await runChainDiscovery(chainId, meta, hdAddresses);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function handleGetBalance(
  address: Address,
  chainId: number,
): Promise<MessageResponse> {
  const client = getPublicClient(chainId);
  const cfg = getNetworkConfig(chainId);
  const isTestnet = cfg?.testnet === true;
  const [balance, nativeUsdPrice] = await Promise.all([
    getBalance(client, { address }),
    isTestnet
      ? Promise.resolve(0)
      : fetchNativePrice(chainId).then((p) => p ?? fetchNativePriceCoinGecko(chainId)),
  ]);
  return { ok: true, data: { balance: formatEther(balance), nativeUsdPrice } };
}

export async function handleSwitchNetwork(chainId: number): Promise<MessageResponse> {
  await setActiveNetworkId(chainId);
  broadcastEvent("chainChanged", numberToHex(chainId));
  return { ok: true };
}

export async function handleSwitchAccount(accountIndex: number): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  if (meta) {
    await saveAccountsMeta(meta.accounts, accountIndex);
    broadcastEvent(
      "accountsChanged",
      meta.accounts.map((a) => a.address),
    );
  }
  return { ok: true };
}

export async function handleExportPrivateKey(
  accountIndex: number,
  password?: string,
): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const mnemonic = await retrieveMnemonic(mode, password, "Export private key");
  const privateKey = wallet.getPrivateKeyForAccount(mnemonic, accountIndex);
  return { ok: true, data: { privateKey } };
}

export async function handleExportMnemonic(password?: string): Promise<MessageResponse> {
  const mode = await getStorageMode();
  const mnemonic = await retrieveMnemonic(mode, password, "Export recovery phrase");
  return { ok: true, data: { mnemonic } };
}

export async function handleResetWallet(password?: string): Promise<MessageResponse> {
  const mode = await getStorageMode();
  await retrieveMnemonic(mode, password, "Reset wallet");
  const { clearAllPending } = await import("../approval");
  clearAllPending();
  await keychain.deleteMnemonic();
  const meta = await loadAccountsMeta();
  if (meta) {
    await keychain.deleteAllImportedKeys(
      meta.accounts.filter((a) => a.path === "imported").map((a) => a.address),
    );
  }
  await clearVault();
  await clearHdDerivedAddresses();
  await clearConnectedOrigins();
  broadcastEvent("accountsChanged", []);
  broadcastEvent("disconnect", { code: 4900, message: "Wallet reset" });
  return { ok: true };
}

export async function handleGetTokenBalances(tokens: Address[]): Promise<MessageResponse> {
  const chainId = await getActiveNetworkId();
  const client = getPublicClient(chainId);
  const meta = await loadAccountsMeta();
  const account = meta?.accounts[meta.activeAccountIndex];
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
  const account = meta?.accounts[meta.activeAccountIndex];
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

export async function handleSendToken(
  tokenAddress: Address,
  to: Address,
  amount: string,
  decimals: number,
): Promise<MessageResponse> {
  const meta = await loadAccountsMeta();
  const account = meta?.accounts[meta.activeAccountIndex];
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, parseUnits(amount, decimals)],
  });

  const { handleRpc } = await import("../rpc-handler");
  const result = await handleRpc(
    "eth_sendTransaction",
    [{ from: account.address, to: tokenAddress, data }],
    { origin: "lion-wallet://popup" },
  );
  return { ok: true, data: result };
}

// ── Multi-send via FeedFaceDisperse ──

import type { DecodedCall, TokenTransfer } from "../../shared/types";

function buildTransfers(entries: MultiSendEntry[]): TokenTransfer[] {
  return entries.map((e) => ({
    direction: "out" as const,
    symbol: e.symbol,
    name: e.tokenName,
    amount: e.amount,
    color: "#627EEA",
    tokenAddress: e.tokenAddress,
  }));
}

export async function handleMultiSend(entries: MultiSendEntry[]): Promise<MessageResponse> {
  if (entries.length === 0) return { ok: false, error: "No entries provided" };

  const meta = await loadAccountsMeta();
  const account = meta?.accounts[meta.activeAccountIndex];
  if (!account) return { ok: false, error: "Wallet not initialized" };

  const chainId = await getActiveNetworkId();
  const network = getNetworkConfig(chainId);
  const { handleRpc } = await import("../rpc-handler");

  const nativeEntries = entries.filter((e) => !e.tokenAddress);
  const erc20ByToken = new Map<Address, MultiSendEntry[]>();
  for (const e of entries) {
    if (!e.tokenAddress) continue;
    const key = e.tokenAddress.toLowerCase() as Address;
    const group = erc20ByToken.get(key) ?? [];
    group.push(e);
    erc20ByToken.set(key, group);
  }

  const disperseAddr = network?.disperseAddress as Address | undefined;
  let queued = 0;

  if (!disperseAddr) {
    // ── Fallback: individual transactions (no Disperse on this chain) ──
    for (const e of nativeEntries) {
      await handleRpc(
        "eth_sendTransaction",
        [
          {
            from: account.address,
            to: e.to,
            value: numberToHex(parseUnits(e.amount, e.decimals)),
          },
        ],
        { origin: "lion-wallet://popup" },
      );
      queued++;
    }
    for (const [tokenAddr, group] of erc20ByToken) {
      for (const e of group) {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [e.to, parseUnits(e.amount, e.decimals)],
        });
        const decoded: DecodedCall = {
          functionName: "transfer",
          args: [
            {
              name: "to",
              type: "address",
              value: `${e.to.slice(0, 6)}…${e.to.slice(-4)}`,
            },
            { name: "amount", type: "uint256", value: `${e.amount} ${e.symbol}` },
          ],
        };
        await handleRpc("eth_sendTransaction", [{ from: account.address, to: tokenAddr, data }], {
          origin: "lion-wallet://popup",
          extras: { prefilled: { decoded, transfers: buildTransfers([e]) } },
        });
        queued++;
      }
    }
    return { ok: true, data: { queued } };
  }

  // ── FeedFaceDisperse: one `disperse` tx for all native + ERC20 rows (after approvals) ──
  const client = getPublicClient(chainId);

  const ethTransfers = nativeEntries.map((e) => ({
    to: e.to,
    amount: parseUnits(e.amount, e.decimals),
  }));
  const totalEthValue = ethTransfers.reduce((sum, t) => sum + t.amount, 0n);

  const tokenTransfers: { token: Address; to: Address; amount: bigint }[] = [];
  for (const e of entries) {
    if (!e.tokenAddress) continue;
    tokenTransfers.push({
      token: e.tokenAddress,
      to: e.to,
      amount: parseUnits(e.amount, e.decimals),
    });
  }

  for (const [tokenAddr, group] of erc20ByToken) {
    const first = group[0];
    if (!first) continue;
    const totalNeeded = group.reduce((sum, e) => sum + parseUnits(e.amount, e.decimals), 0n);

    let currentAllowance = 0n;
    try {
      currentAllowance = (await readContract(client, {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account.address, disperseAddr],
      })) as bigint;
    } catch {
      /* assume 0 */
    }

    if (currentAllowance < totalNeeded) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [disperseAddr, totalNeeded],
      });
      const approveDecoded: DecodedCall = {
        functionName: "approve",
        args: [
          { name: "spender", type: "address", value: "FeedFace Disperse" },
          {
            name: "amount",
            type: "uint256",
            value: `${formatUnits(totalNeeded, first.decimals)} ${first.symbol}`,
          },
        ],
      };
      await handleRpc(
        "eth_sendTransaction",
        [{ from: account.address, to: tokenAddr, data: approveData }],
        { origin: "lion-wallet://popup", extras: { prefilled: { decoded: approveDecoded } } },
      );
      queued++;
    }
  }

  const data = encodeFunctionData({
    abi: feedFaceDisperseAbi,
    functionName: "disperse",
    args: [ethTransfers, tokenTransfers, []],
  });
  const decoded: DecodedCall = {
    contractName: "FeedFaceDisperse",
    functionName: "disperse",
    args: [
      {
        name: "ethTransfers",
        type: "tuple[]",
        value: `${ethTransfers.length} recipient${ethTransfers.length === 1 ? "" : "s"}`,
      },
      {
        name: "tokenTransfers",
        type: "tuple[]",
        value: `${tokenTransfers.length} transfer${tokenTransfers.length === 1 ? "" : "s"}`,
      },
      { name: "permits", type: "tuple[]", value: "none" },
    ],
  };

  await handleRpc(
    "eth_sendTransaction",
    [
      {
        from: account.address,
        to: disperseAddr,
        ...(totalEthValue > 0n ? { value: numberToHex(totalEthValue) } : {}),
        data,
      },
    ],
    {
      origin: "lion-wallet://popup",
      extras: { prefilled: { decoded, transfers: buildTransfers(entries) } },
    },
  );
  queued++;

  return { ok: true, data: { queued } };
}
