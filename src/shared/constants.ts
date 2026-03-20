import {
  // — Mainnets (by popularity / TVL) —
  mainnet, bsc, arbitrum, base, polygon, optimism, avalanche,
  blast, linea, scroll, zkSync, manta, mantle, celo, gnosis,
  fantom, polygonZkEvm, moonbeam, moonriver, aurora, cronos,
  metis, zora, mode, fraxtal, kava, coreDao, harmonyOne,
  klaytn, filecoin, fuse, iotex, rootstock, telos, boba,
  flare, wemix, astar, arbitrumNova, apeChain, worldchain,
  bob, lisk, redstone, sei, taiko, berachain, abstract, ink, hemi,
  // — Testnets —
  sepolia, arbitrumSepolia, baseSepolia, optimismSepolia,
  polygonAmoy, bscTestnet, avalancheFuji, blastSepolia,
  lineaSepolia, scrollSepolia, mantleSepoliaTestnet,
  celoAlfajores, gnosisChiado, fantomTestnet, moonbaseAlpha,
  cronosTestnet, zoraSepolia, modeTestnet, fraxtalTestnet,
  kavaTestnet, klaytnBaobab, filecoinCalibration, iotexTestnet,
  rootstockTestnet, telosTestnet, bobaSepolia, flareTestnet,
  wemixTestnet, bobSepolia, liskSepolia, worldchainSepolia,
  seiTestnet, taikoHekla, berachainBepolia, abstractTestnet,
  inkSepolia, hemiSepolia,
  // — Local dev —
  hardhat,
} from "viem/chains";
import type { NetworkConfig } from "./types";

export const POPUP_ORIGIN = "safari-evm-wallet://popup";

/* Brand colors for well-known chains; unlisted chains get a neutral default */
const CHAIN_COLORS: Record<number, string> = {
  [mainnet.id]: "#627EEA",
  [bsc.id]: "#F0B90B",
  [arbitrum.id]: "#28A0F0",
  [base.id]: "#0052FF",
  [polygon.id]: "#8247E5",
  [optimism.id]: "#FF0420",
  [avalanche.id]: "#E84142",
  [blast.id]: "#FCFC03",
  [linea.id]: "#61DFFF",
  [scroll.id]: "#FFEEDA",
  [zkSync.id]: "#8C8DFC",
  [manta.id]: "#15B5E0",
  [mantle.id]: "#000000",
  [celo.id]: "#FCFF52",
  [gnosis.id]: "#04795B",
  [fantom.id]: "#1969FF",
  [polygonZkEvm.id]: "#7B3FE4",
  [moonbeam.id]: "#53CBC8",
  [moonriver.id]: "#F2B705",
  [aurora.id]: "#70D44B",
  [cronos.id]: "#002D74",
  [metis.id]: "#00DACC",
  [zora.id]: "#2B5DF0",
  [mode.id]: "#DFFE00",
  [fraxtal.id]: "#000000",
  [kava.id]: "#FF564F",
  [coreDao.id]: "#FF9211",
  [harmonyOne.id]: "#00ADE8",
  [klaytn.id]: "#FE3300",
  [filecoin.id]: "#0090FF",
  [fuse.id]: "#B4F9BA",
  [iotex.id]: "#00D4AA",
  [rootstock.id]: "#FF914D",
  [telos.id]: "#571AFF",
  [boba.id]: "#CCFF00",
  [flare.id]: "#E42058",
  [wemix.id]: "#6046FF",
  [astar.id]: "#0070EB",
  [arbitrumNova.id]: "#E57310",
  [apeChain.id]: "#0054FA",
  [worldchain.id]: "#000000",
  [bob.id]: "#F25E31",
  [lisk.id]: "#4070F4",
  [redstone.id]: "#F34242",
  [sei.id]: "#9B1B2E",
  [taiko.id]: "#E81899",
  [berachain.id]: "#7C3503",
  [abstract.id]: "#1D1D1B",
  [ink.id]: "#7C5CFF",
  [hemi.id]: "#FF6B35",
};

const DEFAULT_COLOR = "#8E8E93";

function nc(chain: import("viem").Chain): NetworkConfig {
  return { chain, color: CHAIN_COLORS[chain.id] ?? DEFAULT_COLOR };
}

export const NETWORKS: NetworkConfig[] = [
  // ── Mainnets (popularity order) ──
  nc(mainnet), nc(bsc), nc(arbitrum), nc(base), nc(polygon),
  nc(optimism), nc(avalanche), nc(blast), nc(linea), nc(scroll),
  nc(zkSync), nc(manta), nc(mantle), nc(celo), nc(gnosis),
  nc(fantom), nc(polygonZkEvm), nc(moonbeam), nc(moonriver), nc(aurora),
  nc(cronos), nc(metis), nc(zora), nc(mode), nc(fraxtal),
  nc(kava), nc(coreDao), nc(harmonyOne), nc(klaytn), nc(filecoin),
  nc(fuse), nc(iotex), nc(rootstock), nc(telos), nc(boba),
  nc(flare), nc(wemix), nc(astar), nc(arbitrumNova), nc(apeChain),
  nc(worldchain), nc(bob), nc(lisk), nc(redstone), nc(sei),
  nc(taiko), nc(berachain), nc(abstract), nc(ink), nc(hemi),
  // ── Testnets (same order as parent mainnet) ──
  nc(sepolia), nc(bscTestnet), nc(arbitrumSepolia), nc(baseSepolia),
  nc(polygonAmoy), nc(optimismSepolia), nc(avalancheFuji), nc(blastSepolia),
  nc(lineaSepolia), nc(scrollSepolia),
  nc(mantleSepoliaTestnet), nc(celoAlfajores), nc(gnosisChiado),
  nc(fantomTestnet), nc(moonbaseAlpha),
  nc(cronosTestnet), nc(zoraSepolia), nc(modeTestnet), nc(fraxtalTestnet),
  nc(kavaTestnet), nc(klaytnBaobab), nc(filecoinCalibration),
  nc(iotexTestnet), nc(rootstockTestnet), nc(telosTestnet), nc(bobaSepolia),
  nc(flareTestnet), nc(wemixTestnet),
  nc(bobSepolia), nc(liskSepolia), nc(worldchainSepolia),
  nc(seiTestnet), nc(taikoHekla), nc(berachainBepolia),
  nc(abstractTestnet), nc(inkSepolia), nc(hemiSepolia),
  // ── Local dev ──
  nc(hardhat),
];

export const DEFAULT_NETWORK_ID = mainnet.id;

export const NETWORK_BY_ID = new Map(NETWORKS.map((n) => [n.chain.id, n]));
