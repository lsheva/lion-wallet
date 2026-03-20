import type { DecodedCall, NetworkConfig, TokenTransfer } from "@shared/types";
import { defineChain } from "viem";

export type { DecodedCall, TokenTransfer };

export const MOCK_ACCOUNTS = [
  {
    name: "Account 1",
    address: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B" as const,
    path: "m/44'/60'/0'/0/0",
  },
  {
    name: "Account 2",
    address: "0x8f7E6d5C4b3A2918273645FeDcBa0987654321Ab" as const,
    path: "m/44'/60'/0'/0/1",
  },
];

export const MOCK_SEED_PHRASE = [
  "abandon",
  "ability",
  "able",
  "about",
  "above",
  "absent",
  "absorb",
  "abstract",
  "absurd",
  "abuse",
  "access",
  "accident",
];

export interface Token {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  color: string;
  address?: string;
  decimals: number;
}

export const MOCK_TOKENS: Token[] = [
  {
    symbol: "ETH",
    name: "Ether",
    balance: "3.4521",
    usdValue: "$8,234.12",
    color: "#627EEA",
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    balance: "1,200.00",
    usdValue: "$1,200.00",
    color: "#2775CA",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    balance: "45.20",
    usdValue: "$312.50",
    color: "#FF007A",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    balance: "120.00",
    usdValue: "$1,560.00",
    color: "#2A5ADA",
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    decimals: 18,
  },
];

export type Network = NetworkConfig;

function mockChain(id: number, name: string, symbol: string, rpcUrl: string, testnet?: boolean) {
  return defineChain({
    id,
    name,
    nativeCurrency: { name: symbol, symbol, decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    ...(testnet ? { testnet } : {}),
  });
}

export const NETWORKS: Network[] = [
  { chain: mockChain(1, "Ethereum", "ETH", "https://eth.llamarpc.com"), color: "#627EEA" },
  { chain: mockChain(137, "Polygon", "MATIC", "https://polygon-rpc.com"), color: "#8247E5" },
  {
    chain: mockChain(42161, "Arbitrum One", "ETH", "https://arb1.arbitrum.io/rpc"),
    color: "#28A0F0",
  },
  { chain: mockChain(10, "Optimism", "ETH", "https://mainnet.optimism.io"), color: "#FF0420" },
  { chain: mockChain(8453, "Base", "ETH", "https://mainnet.base.org"), color: "#0052FF" },
  {
    chain: mockChain(56, "BNB Smart Chain", "BNB", "https://bsc-dataseed.binance.org"),
    color: "#F0B90B",
  },
  {
    chain: mockChain(43114, "Avalanche", "AVAX", "https://api.avax.network/ext/bc/C/rpc"),
    color: "#E84142",
  },
  {
    chain: mockChain(11155111, "Sepolia", "ETH", "https://rpc.sepolia.org", true),
    color: "#CFB5F0",
  },
  {
    chain: mockChain(
      421614,
      "Arbitrum Sepolia",
      "ETH",
      "https://sepolia-rollup.arbitrum.io/rpc",
      true,
    ),
    color: "#28A0F0",
  },
  { chain: mockChain(31337, "Hardhat", "ETH", "http://127.0.0.1:8545", true), color: "#FFF100" },
];

export interface DecodedArg {
  name: string;
  type: string;
  value: string;
}

export const MOCK_TX_REQUEST = {
  origin: "app.uniswap.org",
  favicon: "https://app.uniswap.org/favicon.ico",
  method: "eth_sendTransaction",
  params: {
    to: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    value: "0.5 ETH",
    valueUsd: "$1,215.00",
    gasLimit: "195000",
    maxFee: "32 gwei",
    data: "0x5ae401dc00000000000000000000000000000000000000000000000000000000661e7a7f00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001",
  },
  decoded: {
    contractName: "SwapRouter02",
    functionName: "exactInputSingle",
    args: [
      { name: "tokenIn", type: "address", value: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
      { name: "tokenOut", type: "address", value: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
      { name: "fee", type: "uint24", value: "3000" },
      { name: "recipient", type: "address", value: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B" },
      { name: "amountIn", type: "uint256", value: "500000000000000000" },
      { name: "amountOutMinimum", type: "uint256", value: "1180000000" },
      { name: "sqrtPriceLimitX96", type: "uint160", value: "0" },
    ],
  } as DecodedCall,
  transfers: [
    {
      direction: "out",
      symbol: "ETH",
      name: "Ethereum",
      amount: "0.5",
      usdValue: "$1,215.00",
      color: "#627EEA",
    },
    {
      direction: "in",
      symbol: "USDC",
      name: "USD Coin",
      amount: "1,180.00",
      usdValue: "$1,180.00",
      color: "#2775CA",
    },
  ] as TokenTransfer[],
  totalUsd: "$2,395.00",
  estimatedFee: "$2.40",
};

export const MOCK_SIGN_REQUEST = {
  origin: "opensea.io",
  favicon: "https://opensea.io/favicon.ico",
  method: "personal_sign",
  message:
    "Sign in to OpenSea\n\nNonce: 8a3f2b4c1d5e6f7a\nTimestamp: 2026-03-19T12:00:00Z\n\nBy signing, you agree to the Terms of Service.",
};
