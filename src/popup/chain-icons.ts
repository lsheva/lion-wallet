import abstractIcon from "@web3icons/core/svgs/networks/branded/abstract.svg.js";
import apeChainIcon from "@web3icons/core/svgs/networks/branded/apechain.svg.js";
import arbitrumNovaIcon from "@web3icons/core/svgs/networks/branded/arbitrum-nova.svg.js";
import arbitrumIcon from "@web3icons/core/svgs/networks/branded/arbitrum-one.svg.js";
import astarIcon from "@web3icons/core/svgs/networks/branded/astar.svg.js";
import auroraIcon from "@web3icons/core/svgs/networks/branded/aurora.svg.js";
import avalancheIcon from "@web3icons/core/svgs/networks/branded/avalanche.svg.js";
import baseIcon from "@web3icons/core/svgs/networks/branded/base.svg.js";
import berachainIcon from "@web3icons/core/svgs/networks/branded/berachain.svg.js";
import bscIcon from "@web3icons/core/svgs/networks/branded/binance-smart-chain.svg.js";
import blastIcon from "@web3icons/core/svgs/networks/branded/blast.svg.js";
import bobIcon from "@web3icons/core/svgs/networks/branded/bob.svg.js";
import bobaIcon from "@web3icons/core/svgs/networks/branded/boba.svg.js";
import celoIcon from "@web3icons/core/svgs/networks/branded/celo.svg.js";
import cronosIcon from "@web3icons/core/svgs/networks/branded/cronos.svg.js";
import ethereumIcon from "@web3icons/core/svgs/networks/branded/ethereum.svg.js";
import fantomIcon from "@web3icons/core/svgs/networks/branded/fantom.svg.js";
import filecoinIcon from "@web3icons/core/svgs/networks/branded/filecoin.svg.js";
import flareIcon from "@web3icons/core/svgs/networks/branded/flare.svg.js";
import fraxtalIcon from "@web3icons/core/svgs/networks/branded/fraxtal.svg.js";
import fuseIcon from "@web3icons/core/svgs/networks/branded/fuse.svg.js";
import gnosisIcon from "@web3icons/core/svgs/networks/branded/gnosis.svg.js";
import harmonyIcon from "@web3icons/core/svgs/networks/branded/harmony.svg.js";
import hemiIcon from "@web3icons/core/svgs/networks/branded/hemi.svg.js";
import inkIcon from "@web3icons/core/svgs/networks/branded/ink.svg.js";
import iotexIcon from "@web3icons/core/svgs/networks/branded/iotex.svg.js";
import kaiaIcon from "@web3icons/core/svgs/networks/branded/kaia.svg.js";
import kavaIcon from "@web3icons/core/svgs/networks/branded/kava.svg.js";
import lineaIcon from "@web3icons/core/svgs/networks/branded/linea.svg.js";
import liskIcon from "@web3icons/core/svgs/networks/branded/lisk.svg.js";
import mantaIcon from "@web3icons/core/svgs/networks/branded/manta-pacific.svg.js";
import mantleIcon from "@web3icons/core/svgs/networks/branded/mantle.svg.js";
import metisIcon from "@web3icons/core/svgs/networks/branded/metis-andromeda.svg.js";
import modeIcon from "@web3icons/core/svgs/networks/branded/mode.svg.js";
import moonbaseAlphaIcon from "@web3icons/core/svgs/networks/branded/moonbase-alpha.svg.js";
import moonbeamIcon from "@web3icons/core/svgs/networks/branded/moonbeam.svg.js";
import moonriverIcon from "@web3icons/core/svgs/networks/branded/moonriver.svg.js";
import optimismIcon from "@web3icons/core/svgs/networks/branded/optimism.svg.js";
import polygonIcon from "@web3icons/core/svgs/networks/branded/polygon.svg.js";
import polygonZkEvmIcon from "@web3icons/core/svgs/networks/branded/polygon-zkevm.svg.js";
import rootstockIcon from "@web3icons/core/svgs/networks/branded/rootstock.svg.js";
import scrollIcon from "@web3icons/core/svgs/networks/branded/scroll.svg.js";
import seiIcon from "@web3icons/core/svgs/networks/branded/sei-network.svg.js";
import taikoIcon from "@web3icons/core/svgs/networks/branded/taiko.svg.js";
import telosIcon from "@web3icons/core/svgs/networks/branded/telos.svg.js";
import worldIcon from "@web3icons/core/svgs/networks/branded/world.svg.js";
import zksyncIcon from "@web3icons/core/svgs/networks/branded/zksync.svg.js";
import zoraIcon from "@web3icons/core/svgs/networks/branded/zora.svg.js";

import {
  abstract as abstractChain,
  abstractTestnet,
  apeChain,
  arbitrum,
  arbitrumNova,
  arbitrumSepolia,
  astar,
  aurora,
  avalanche,
  avalancheFuji,
  base,
  baseSepolia,
  berachain,
  berachainBepolia,
  blast,
  blastSepolia,
  bob,
  boba,
  bobaSepolia,
  bobSepolia,
  bsc,
  bscTestnet,
  celo,
  celoAlfajores,
  cronos,
  cronosTestnet,
  fantom,
  fantomTestnet,
  filecoin,
  filecoinCalibration,
  flare,
  flareTestnet,
  fraxtal,
  fraxtalTestnet,
  fuse,
  gnosis,
  harmonyOne,
  hemi,
  hemiSepolia,
  ink,
  inkSepolia,
  iotex,
  kava,
  kavaTestnet,
  klaytn,
  klaytnBaobab,
  linea,
  lineaSepolia,
  lisk,
  liskSepolia,
  mainnet,
  manta,
  mantle,
  mantleSepoliaTestnet,
  metis,
  mode,
  modeTestnet,
  moonbaseAlpha,
  moonbeam,
  moonriver,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  polygonZkEvm,
  rootstock,
  scroll,
  scrollSepolia,
  sei,
  seiTestnet,
  sepolia,
  taiko,
  taikoHekla,
  telos,
  telosTestnet,
  worldchain,
  worldchainSepolia,
  zkSync,
  zora,
} from "viem/chains";

/**
 * Chain ID → SVG markup string.
 * Testnets without their own icon reuse the parent mainnet icon.
 */
export const CHAIN_ICON_BY_ID = new Map<number, string>([
  [mainnet.id, ethereumIcon],
  [bsc.id, bscIcon],
  [arbitrum.id, arbitrumIcon],
  [base.id, baseIcon],
  [polygon.id, polygonIcon],
  [optimism.id, optimismIcon],
  [avalanche.id, avalancheIcon],
  [blast.id, blastIcon],
  [linea.id, lineaIcon],
  [scroll.id, scrollIcon],
  [zkSync.id, zksyncIcon],
  [manta.id, mantaIcon],
  [mantle.id, mantleIcon],
  [celo.id, celoIcon],
  [gnosis.id, gnosisIcon],
  [fantom.id, fantomIcon],
  [polygonZkEvm.id, polygonZkEvmIcon],
  [moonbeam.id, moonbeamIcon],
  [moonriver.id, moonriverIcon],
  [aurora.id, auroraIcon],
  [cronos.id, cronosIcon],
  [metis.id, metisIcon],
  [zora.id, zoraIcon],
  [mode.id, modeIcon],
  [fraxtal.id, fraxtalIcon],
  [kava.id, kavaIcon],
  [harmonyOne.id, harmonyIcon],
  [klaytn.id, kaiaIcon],
  [filecoin.id, filecoinIcon],
  [fuse.id, fuseIcon],
  [iotex.id, iotexIcon],
  [rootstock.id, rootstockIcon],
  [telos.id, telosIcon],
  [boba.id, bobaIcon],
  [flare.id, flareIcon],
  [astar.id, astarIcon],
  [arbitrumNova.id, arbitrumNovaIcon],
  [apeChain.id, apeChainIcon],
  [worldchain.id, worldIcon],
  [bob.id, bobIcon],
  [lisk.id, liskIcon],
  [sei.id, seiIcon],
  [taiko.id, taikoIcon],
  [berachain.id, berachainIcon],
  [abstractChain.id, abstractIcon],
  [ink.id, inkIcon],
  [hemi.id, hemiIcon],
  // Testnets — reuse parent mainnet icon where no dedicated icon exists
  [sepolia.id, ethereumIcon],
  [arbitrumSepolia.id, arbitrumIcon],
  [baseSepolia.id, baseIcon],
  [optimismSepolia.id, optimismIcon],
  [polygonAmoy.id, polygonIcon],
  [bscTestnet.id, bscIcon],
  [avalancheFuji.id, avalancheIcon],
  [blastSepolia.id, blastIcon],
  [lineaSepolia.id, lineaIcon],
  [scrollSepolia.id, scrollIcon],
  [mantleSepoliaTestnet.id, mantleIcon],
  [celoAlfajores.id, celoIcon],
  [fantomTestnet.id, fantomIcon],
  [moonbaseAlpha.id, moonbaseAlphaIcon],
  [cronosTestnet.id, cronosIcon],
  [modeTestnet.id, modeIcon],
  [fraxtalTestnet.id, fraxtalIcon],
  [kavaTestnet.id, kavaIcon],
  [klaytnBaobab.id, kaiaIcon],
  [filecoinCalibration.id, filecoinIcon],
  [telosTestnet.id, telosIcon],
  [bobaSepolia.id, bobaIcon],
  [flareTestnet.id, flareIcon],
  [bobSepolia.id, bobIcon],
  [liskSepolia.id, liskIcon],
  [worldchainSepolia.id, worldIcon],
  [seiTestnet.id, seiIcon],
  [taikoHekla.id, taikoIcon],
  [berachainBepolia.id, berachainIcon],
  [abstractTestnet.id, abstractIcon],
  [inkSepolia.id, inkIcon],
  [hemiSepolia.id, hemiIcon],
]);
