/**
 * Network signals: the user's curated chain list, the active chain id, and
 * the network-selector visibility flag. Per-chain orchestration (switching,
 * scanning) lives in [`./index.ts`](./index.ts).
 */
import { CHAINS } from "@shared/constants";
import type { ChainMeta } from "@shared/types";
import { createMemo, createRoot, createSignal } from "solid-js";
import { CHAIN_COLOR_BY_ID } from "../chain-ui.generated";
import { buildInitialNetworks, saveNetworkIds } from "./cache";

const DEFAULT_COLOR = "#8E8E93";

export const ALL_CHAINS = CHAINS;

export const [activeNetworkId, setActiveNetworkId] = createSignal(1);
export const [showNetworkSelector, setShowNetworkSelector] = createSignal(false);
export const [networks, setRawNetworks] = createSignal<ChainMeta[]>(buildInitialNetworks());

export function setNetworks(chains: ChainMeta[]): void {
  setRawNetworks(chains);
  saveNetworkIds(chains);
}

const derived = createRoot(() => {
  const networkMap = createMemo(() => new Map(networks().map((n) => [n.id, n])));

  const activeNetwork = createMemo(
    () => networkMap().get(activeNetworkId()) ?? (networks()[0] as ChainMeta),
  );

  return { activeNetwork };
});

export const { activeNetwork } = derived;

export function chainColor(chainId: number): string {
  return CHAIN_COLOR_BY_ID.get(chainId) ?? DEFAULT_COLOR;
}
