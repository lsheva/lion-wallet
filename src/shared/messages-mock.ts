import { IMPORTED_KEYRING_ID } from "@shared/keyring-constants";
import type { Address, Hex } from "viem";
import { mnemonicToAccount } from "viem/accounts";

import {
  DEV_MOCK_ACCOUNTS,
  DEV_MOCK_KEYRINGS,
  MOCK_ACTIVITY,
  MOCK_TOKENS,
} from "../popup/mock/data";
import type { MessageRequest, MessageResponse } from "./messages";
import type {
  ActivityItem,
  AddressBookEntry,
  KeyringPublic,
  RecentAddress,
  SerializedAccount,
  StoredToken,
  WalletState,
} from "./types";

const TEST_MNEMONIC = "test test test test test test test test test test test junk";

function buildInitialWallet(): WalletState {
  const accounts = DEV_MOCK_ACCOUNTS.map((a) => ({ ...a }));
  const first = accounts[0];
  return {
    isInitialized: true,
    storageMode: "keychain",
    keyrings: DEV_MOCK_KEYRINGS.map((k) => ({ ...k })),
    accounts,
    activeAccountAddress: (first?.address ?? "0x0") as Address,
    activeNetworkId: 1,
  };
}

let mockWallet: WalletState = buildInitialWallet();
const mockAddressBook: AddressBookEntry[] = [];
const mockRecent: RecentAddress[] = [];
const mockConnectedOrigins: string[] = [];

function discoveredTokens(chainId: number): StoredToken[] {
  const out: StoredToken[] = [];
  for (const t of MOCK_TOKENS) {
    if (!t.address) continue;
    let lastBalance: string | undefined;
    if (t.symbol === "USDC") lastBalance = "1200000000000";
    else if (t.symbol === "UNI") lastBalance = "45200000000000000000";
    else if (t.symbol === "LINK") lastBalance = "120000000000000000000";
    out.push({
      address: t.address,
      chainId,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      source: "scan",
      addedAt: Date.now(),
      ...(lastBalance ? { lastBalance } : {}),
    });
  }
  return out;
}

const MOCK_GAS_PRESETS = {
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
} as const;

const MOCK_RECEIPT_BLOCK = "0x10";
const MOCK_HEAD_BLOCK = "0x1b";

export async function mockSendMessage(message: MessageRequest): Promise<MessageResponse> {
  await Promise.resolve();
  const m = message;

  switch (m.type) {
    case "GET_STATE":
      return {
        ok: true,
        data: { ...mockWallet, accounts: mockWallet.accounts.map((a) => ({ ...a })) },
      };

    case "GET_ACCOUNTS":
      return { ok: true, data: { accounts: mockWallet.accounts.map((a) => ({ ...a })) } };

    case "GET_STORAGE_MODE":
      return { ok: true, data: { storageMode: mockWallet.storageMode } };

    case "CHECK_KEYCHAIN_AVAILABLE":
      return { ok: true, data: { available: true } };

    case "GET_PENDING_APPROVAL":
      return { ok: true, data: null };

    case "ENRICH_APPROVAL":
      return {
        ok: true,
        data: {
          gasPresets: { ...MOCK_GAS_PRESETS },
          gasEstimateError: null,
          decoded: null,
          transfers: null,
          nativeUsdPrice: 2385,
          decodedVia: null,
          simulatedVia: null,
          hasEtherscanKey: false,
          hasRpcProviderKey: false,
        },
      };

    case "APPROVE_REQUEST":
      return { ok: true, data: { result: `0x${"1".repeat(64)}` } };

    case "REJECT_REQUEST":
      return { ok: true };

    case "RPC_REQUEST": {
      if (m.method === "eth_getTransactionReceipt" && typeof m.params?.[0] === "string") {
        return {
          ok: true,
          data: { result: { blockNumber: MOCK_RECEIPT_BLOCK, status: "0x1" } },
        };
      }
      if (m.method === "eth_blockNumber") {
        return { ok: true, data: { result: MOCK_HEAD_BLOCK } };
      }
      return { ok: true, data: { result: null } };
    }

    case "GET_BALANCE":
      return {
        ok: true,
        data: { balance: "3.4521", nativeUsdPrice: 2385 },
      };

    case "GET_TOKEN_BALANCES": {
      const balances: Record<string, string> = {};
      for (const addr of m.tokens) {
        balances[addr.toLowerCase()] =
          addr.toLowerCase() === "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
            ? "1200000000000"
            : "45200000000000000000";
      }
      return { ok: true, data: { balances } };
    }

    case "GET_TOKEN_PRICE":
      return { ok: true, data: { price: m.address ? 1 : null } };

    case "GET_DISCOVERED_TOKENS":
      return { ok: true, data: { tokens: discoveredTokens(m.chainId) } };

    case "SCAN_TOKENS":
      return { ok: true, data: { found: 0 } };

    case "GET_ACTIVITY":
      return {
        ok: true,
        data: {
          items: MOCK_ACTIVITY as unknown as ActivityItem[],
          hasMore: false,
          source: "etherscan",
        },
      };

    case "CLEAR_ACTIVITY_CACHE":
      return { ok: true };

    case "GET_TOKEN_INFO":
      return {
        ok: true,
        data: { name: "Mock Token", symbol: "MOCK", decimals: 18, balance: "0" },
      };

    case "GET_TOKEN_IMAGE":
      return { ok: true, data: { url: null } };

    case "HIDE_DISCOVERED_TOKEN":
    case "ADD_MANUAL_TOKEN":
      return { ok: true };

    case "SEND_TOKEN":
      return { ok: true };

    case "MULTI_SEND":
      return { ok: true, data: { queued: m.entries.length } };

    case "SWITCH_NETWORK": {
      mockWallet = { ...mockWallet, activeNetworkId: m.chainId };
      return { ok: true };
    }

    case "SWITCH_ACCOUNT": {
      mockWallet = { ...mockWallet, activeAccountAddress: m.activeAccountAddress };
      return { ok: true };
    }

    case "ESTIMATE_GAS":
      return { ok: true, data: { ...MOCK_GAS_PRESETS } };

    case "ENSURE_CHAIN_DISCOVERY":
      return {
        ok: true,
        data: {
          activeAccountIndices: mockWallet.accounts.map((_, i) => i),
          scannedAt: Date.now(),
        },
      };

    case "RENAME_ACCOUNT": {
      const idx = mockWallet.accounts.findIndex(
        (a) => a.address.toLowerCase() === m.address.toLowerCase(),
      );
      if (idx >= 0) {
        const next = [...mockWallet.accounts];
        const cur = next[idx];
        if (cur) next[idx] = { ...cur, name: m.name };
        mockWallet = { ...mockWallet, accounts: next };
      }
      return { ok: true };
    }

    case "CREATE_WALLET": {
      const acct = mnemonicToAccount(TEST_MNEMONIC, { path: "m/44'/60'/0'/0/0" });
      const account: SerializedAccount = {
        name: "Account 1",
        address: acct.address,
        path: "m/44'/60'/0'/0/0",
        index: 0,
        keyringId: "mock-kr",
      };
      const kr: KeyringPublic = { id: "mock-kr", label: "Main Wallet", type: "hd" };
      mockWallet = {
        isInitialized: true,
        storageMode: m.password ? "vault" : "keychain",
        accounts: [account],
        keyrings: [kr],
        activeAccountAddress: account.address,
        activeNetworkId: 1,
      };
      return { ok: true, data: { mnemonic: TEST_MNEMONIC, accounts: [account] } };
    }

    case "IMPORT_WALLET": {
      const accs = DEV_MOCK_ACCOUNTS.slice(0, 2).map((a) => ({ ...a }));
      mockWallet = {
        ...mockWallet,
        accounts: accs,
        activeAccountAddress: accs[0]?.address ?? mockWallet.activeAccountAddress,
      };
      return { ok: true, data: { accounts: accs } };
    }

    case "IMPORT_PRIVATE_KEY": {
      const acc: SerializedAccount = {
        name: "Imported",
        address: "0x1111111111111111111111111111111111111111" as Address,
        path: "imported",
        index: mockWallet.accounts.filter((a) => a.path === "imported").length,
        keyringId: IMPORTED_KEYRING_ID,
      };
      mockWallet = {
        ...mockWallet,
        accounts: [...mockWallet.accounts, acc],
      };
      return { ok: true, data: { accounts: [acc] } };
    }

    case "ADD_ACCOUNT": {
      const i = mockWallet.accounts.length;
      const path = `m/44'/60'/0'/0/${i}` as const;
      const account: SerializedAccount = {
        name: `Account ${i + 1}`,
        address: mnemonicToAccount(TEST_MNEMONIC, { path }).address,
        path,
        index: i,
        keyringId: mockWallet.keyrings[0]?.id ?? "mock-kr",
      };
      mockWallet = { ...mockWallet, accounts: [...mockWallet.accounts, account] };
      return { ok: true, data: { account } };
    }

    case "ADD_KEYRING_CREATE": {
      const mnemonic =
        "legal winner thank year wave sausage worth useful legal winner thank yellow";
      const account: SerializedAccount = {
        name: "Imported phrase · 1",
        address: mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" }).address,
        path: "m/44'/60'/0'/0/0",
        index: 0,
        keyringId: "mock-kr-imported",
      };
      const kr: KeyringPublic = { id: "mock-kr-imported", label: "Imported wallet", type: "hd" };
      mockWallet = {
        ...mockWallet,
        accounts: [...mockWallet.accounts, account],
        keyrings: [...mockWallet.keyrings, kr],
      };
      return {
        ok: true,
        data: {
          mnemonic,
          accounts: [account],
          keyrings: mockWallet.keyrings.map((k) => ({ ...k })),
        },
      };
    }

    case "ADD_KEYRING_IMPORT": {
      const mnemonic = m.mnemonic.trim();
      const account: SerializedAccount = {
        name: "Imported phrase · 1",
        address: mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" }).address,
        path: "m/44'/60'/0'/0/0",
        index: 0,
        keyringId: "mock-kr-imported",
      };
      const kr: KeyringPublic = { id: "mock-kr-imported", label: "Imported wallet", type: "hd" };
      mockWallet = {
        ...mockWallet,
        accounts: [...mockWallet.accounts, account],
        keyrings: [...mockWallet.keyrings.filter((k) => k.id !== kr.id), kr],
      };
      return {
        ok: true,
        data: {
          accounts: [account],
          keyrings: mockWallet.keyrings.map((k) => ({ ...k })),
        },
      };
    }

    case "DERIVE_ACCOUNT": {
      const i = mockWallet.accounts.filter((a) => a.keyringId === m.keyringId).length;
      const path = `m/44'/60'/0'/0/${i}` as const;
      const account: SerializedAccount = {
        name: `Account ${mockWallet.accounts.length + 1}`,
        address: mnemonicToAccount(TEST_MNEMONIC, { path }).address,
        path,
        index: i,
        keyringId: m.keyringId,
      };
      mockWallet = { ...mockWallet, accounts: [...mockWallet.accounts, account] };
      return { ok: true, data: { account } };
    }

    case "RENAME_KEYRING":
      return { ok: true };

    case "DELETE_KEYRING": {
      mockWallet = {
        ...mockWallet,
        keyrings: mockWallet.keyrings.filter((k) => k.id !== m.keyringId),
        accounts: mockWallet.accounts.filter((a) => a.keyringId !== m.keyringId),
      };
      return { ok: true };
    }

    case "REMOVE_ACCOUNT": {
      mockWallet = {
        ...mockWallet,
        accounts: mockWallet.accounts.filter(
          (a) => a.address.toLowerCase() !== m.address.toLowerCase(),
        ),
      };
      return { ok: true };
    }

    case "EXPORT_PRIVATE_KEY":
      return {
        ok: true,
        data: {
          privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex,
        },
      };

    case "EXPORT_MNEMONIC":
      return { ok: true, data: { mnemonic: TEST_MNEMONIC } };

    case "RESET_WALLET":
      mockWallet = buildInitialWallet();
      mockAddressBook.length = 0;
      mockRecent.length = 0;
      mockConnectedOrigins.length = 0;
      return { ok: true };

    case "GET_ETHERSCAN_KEY":
    case "GET_RPC_PROVIDER_KEY":
      return { ok: true, data: { key: null } };

    case "SET_ETHERSCAN_KEY":
    case "SET_RPC_PROVIDER_KEY":
      return { ok: true };

    case "GET_ADDRESS_BOOK":
      return {
        ok: true,
        data: {
          entries: mockAddressBook.map((e) => ({ ...e })),
          recent: mockRecent.map((r) => ({ ...r })),
        },
      };

    case "UPSERT_ADDRESS_BOOK_ENTRY": {
      const checksummed = m.address;
      const lower = checksummed.toLowerCase();
      const idx = mockAddressBook.findIndex((e) => e.address.toLowerCase() === lower);
      if (idx >= 0) {
        const existing = mockAddressBook[idx];
        if (existing)
          mockAddressBook[idx] = { address: checksummed, name: m.name, addedAt: existing.addedAt };
      } else {
        mockAddressBook.push({ address: checksummed, name: m.name, addedAt: Date.now() });
      }
      return { ok: true };
    }

    case "REMOVE_ADDRESS_BOOK_ENTRY": {
      const lower = m.address.toLowerCase();
      const i = mockAddressBook.findIndex((e) => e.address.toLowerCase() === lower);
      if (i >= 0) mockAddressBook.splice(i, 1);
      return { ok: true };
    }

    case "GET_CONNECTED_SITES":
      return { ok: true, data: { origins: [...mockConnectedOrigins] } };

    case "REVOKE_CONNECTED_ORIGIN": {
      const i = mockConnectedOrigins.indexOf(m.origin);
      if (i >= 0) mockConnectedOrigins.splice(i, 1);
      return { ok: true };
    }

    case "CHECK_UPDATE":
      return {
        ok: true,
        data: {
          current: "0.0.0",
          latest: "0.0.0",
          downloadUrl: "",
          updateAvailable: false,
        },
      };

    default: {
      const unknown = m as MessageRequest;
      return { ok: false, error: `Mock: unhandled ${unknown.type}` };
    }
  }
}
