import type { NetworkConfig } from "./types";

export const POPUP_ORIGIN = "safari-evm-wallet://popup";

export const NETWORKS: NetworkConfig[] = [
  { id: 1, name: "Ethereum", symbol: "ETH", color: "#627EEA", rpcUrl: "https://eth.llamarpc.com", blockExplorerUrl: "https://etherscan.io" },
  { id: 137, name: "Polygon", symbol: "MATIC", color: "#8247E5", rpcUrl: "https://polygon-rpc.com", blockExplorerUrl: "https://polygonscan.com" },
  { id: 42161, name: "Arbitrum One", symbol: "ETH", color: "#28A0F0", rpcUrl: "https://arb1.arbitrum.io/rpc", blockExplorerUrl: "https://arbiscan.io" },
  { id: 10, name: "Optimism", symbol: "ETH", color: "#FF0420", rpcUrl: "https://mainnet.optimism.io", blockExplorerUrl: "https://optimistic.etherscan.io" },
  { id: 8453, name: "Base", symbol: "ETH", color: "#0052FF", rpcUrl: "https://mainnet.base.org", blockExplorerUrl: "https://basescan.org" },
  { id: 56, name: "BNB Smart Chain", symbol: "BNB", color: "#F0B90B", rpcUrl: "https://bsc-dataseed.binance.org", blockExplorerUrl: "https://bscscan.com" },
  { id: 43114, name: "Avalanche", symbol: "AVAX", color: "#E84142", rpcUrl: "https://api.avax.network/ext/bc/C/rpc", blockExplorerUrl: "https://snowtrace.io" },
  { id: 11155111, name: "Sepolia", symbol: "ETH", color: "#CFB5F0", rpcUrl: "https://rpc.sepolia.org", blockExplorerUrl: "https://sepolia.etherscan.io", testnet: true },
];

export const DEFAULT_NETWORK_ID = 1;

export const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
