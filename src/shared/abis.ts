import { toFunctionSelector } from "viem";

export const ERC20_TRANSFER_SELECTOR = toFunctionSelector("transfer(address,uint256)");

export const erc20Abi = [
  {
    type: "event",
    name: "Approval",
    inputs: [
      { indexed: true, name: "owner", type: "address" },
      { indexed: true, name: "spender", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

/** FeedFaceDisperse — single-call batch ETH + ERC20 (SafeERC20), optional ERC2612 permits */
export const feedFaceDisperseAbi = [
  { type: "error", inputs: [], name: "EthRefundFailed" },
  { type: "error", inputs: [], name: "EthTransferFailed" },
  {
    type: "error",
    inputs: [{ name: "token", internalType: "address", type: "address" }],
    name: "SafeERC20FailedOperation",
  },
  {
    type: "function",
    inputs: [
      {
        name: "ethTransfers",
        internalType: "struct FeedFaceDisperse.EthTransfer[]",
        type: "tuple[]",
        components: [
          { name: "to", internalType: "address", type: "address" },
          { name: "amount", internalType: "uint256", type: "uint256" },
        ],
      },
      {
        name: "tokenTransfers",
        internalType: "struct FeedFaceDisperse.TokenTransfer[]",
        type: "tuple[]",
        components: [
          { name: "token", internalType: "address", type: "address" },
          { name: "to", internalType: "address", type: "address" },
          { name: "amount", internalType: "uint256", type: "uint256" },
        ],
      },
      {
        name: "permits",
        internalType: "struct FeedFaceDisperse.Permit[]",
        type: "tuple[]",
        components: [
          { name: "token", internalType: "address", type: "address" },
          { name: "value", internalType: "uint256", type: "uint256" },
          { name: "deadline", internalType: "uint256", type: "uint256" },
          { name: "v", internalType: "uint8", type: "uint8" },
          { name: "r", internalType: "bytes32", type: "bytes32" },
          { name: "s", internalType: "bytes32", type: "bytes32" },
        ],
      },
    ],
    name: "disperse",
    outputs: [],
    stateMutability: "payable",
  },
] as const;

/** Subset of ERC-20 extensions used for approval method detection. */
export const erc20ExtAbi = [
  {
    type: "function",
    name: "increaseAllowance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "addedValue", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "permit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;
