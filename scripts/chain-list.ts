import * as c from "viem/chains";

/** FeedFace disperse (CREATE2); deployed where `disperse` is set below. */
const FEEDFACE_DISPERSE = "0xFEED8f72DBc14fdf99D97E9CC1EAD65828a3FACE";

export default [
  // ── Mainnets (by popularity / TVL) ──
  {
    chain: c.mainnet,
    color: "#627EEA",
    icon: "ethereum",
    alchemy: "eth-mainnet",
    trust: "ethereum",
    disperse: FEEDFACE_DISPERSE,
  },
  {
    chain: c.bsc,
    color: "#F0B90B",
    icon: "binance-smart-chain",
    trust: "smartchain",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.arbitrum,
    color: "#28A0F0",
    icon: "arbitrum-one",
    alchemy: "arb-mainnet",
    trust: "arbitrum",
    disperse: FEEDFACE_DISPERSE,
  },
  {
    chain: c.base,
    color: "#0052FF",
    icon: "base",
    alchemy: "base-mainnet",
    trust: "base",
    disperse: FEEDFACE_DISPERSE,
  },
  {
    chain: c.polygon,
    color: "#8247E5",
    icon: "polygon",
    alchemy: "polygon-mainnet",
    trust: "polygon",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.optimism,
    color: "#FF0420",
    icon: "optimism",
    alchemy: "opt-mainnet",
    trust: "optimism",
    disperse: FEEDFACE_DISPERSE,
  },
  {
    chain: c.avalanche,
    color: "#E84142",
    icon: "avalanche",
    alchemy: "avax-mainnet",
    trust: "avalanchec",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.blast,
    color: "#FCFC03",
    icon: "blast",
    alchemy: "blast-mainnet",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.linea,
    color: "#61DFFF",
    icon: "linea",
    alchemy: "linea-mainnet",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.scroll,
    color: "#FFEEDA",
    icon: "scroll",
    alchemy: "scroll-mainnet",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  { chain: c.zkSync, color: "#8C8DFC", icon: "zksync", alchemy: "zksync-mainnet", trust: "zksync" },
  { chain: c.manta, color: "#15B5E0", icon: "manta-pacific" },
  {
    chain: c.mantle,
    color: "#000000",
    icon: "mantle",
    alchemy: "mantle-mainnet",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.celo,
    color: "#FCFF52",
    icon: "celo",
    alchemy: "celo-mainnet",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.gnosis,
    color: "#04795B",
    icon: "gnosis",
    alchemy: "gnosis-mainnet",
    trust: "xdai",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.fantom,
    color: "#1969FF",
    icon: "fantom",
    alchemy: "fantom-mainnet",
    trust: "fantom",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.polygonZkEvm,
    color: "#7B3FE4",
    icon: "polygon-zkevm",
    alchemy: "polygonzkevm-mainnet",
  },
  {
    chain: c.moonbeam,
    color: "#53CBC8",
    icon: "moonbeam",
    alchemy: "moonbeam-mainnet",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.moonriver,
    color: "#F2B705",
    icon: "moonriver",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  { chain: c.aurora, color: "#70D44B", icon: "aurora" },
  { chain: c.cronos, color: "#002D74", icon: "cronos" },
  { chain: c.metis, color: "#00DACC", icon: "metis-andromeda" },
  { chain: c.zora, color: "#2B5DF0", icon: "zora" },
  { chain: c.mode, color: "#DFFE00", icon: "mode" },
  {
    chain: c.fraxtal,
    color: "#000000",
    icon: "fraxtal",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  { chain: c.kava, color: "#FF564F", icon: "kava" },
  { chain: c.coreDao, color: "#FF9211" },
  { chain: c.harmonyOne, color: "#00ADE8", icon: "harmony" },
  { chain: c.klaytn, color: "#FE3300", icon: "kaia" },
  { chain: c.filecoin, color: "#0090FF", icon: "filecoin" },
  { chain: c.fuse, color: "#B4F9BA", icon: "fuse" },
  { chain: c.iotex, color: "#00D4AA" },
  { chain: c.rootstock, color: "#FF914D", icon: "rootstock" },
  { chain: c.telos, color: "#571AFF", icon: "telos" },
  { chain: c.boba, color: "#CCFF00", icon: "boba" },
  { chain: c.flare, color: "#E42058", icon: "flare" },
  { chain: c.wemix, color: "#6046FF" },
  { chain: c.astar, color: "#0070EB", alchemy: "astar-mainnet" },
  { chain: c.arbitrumNova, color: "#E57310", icon: "arbitrum-nova" },
  {
    chain: c.apeChain,
    color: "#0054FA",
    icon: "apechain",
    //disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.worldchain,
    color: "#000000",
    icon: "world",
    //disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  { chain: c.bob, color: "#F25E31", icon: "bob" },
  { chain: c.lisk, color: "#4070F4", icon: "lisk" },
  { chain: c.redstone, color: "#F34242" },
  {
    chain: c.sei,
    color: "#9B1B2E",
    icon: "sei-network",
    //disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.taiko,
    color: "#E81899",
    icon: "taiko",
    //disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  {
    chain: c.berachain,
    color: "#7C3503", //disperse: "0xD152f549545093347A162Dce210e7293f1452150"
  },
  {
    chain: c.abstract,
    color: "#1D1D1B",
    icon: "abstract",
    // disperse: "0xD152f549545093347A162Dce210e7293f1452150",
  },
  { chain: c.ink, color: "#7C5CFF", icon: "ink" },
  { chain: c.hemi, color: "#FF6B35", icon: "hemi" },
  // ── Testnets (same order as parent mainnet) ──
  {
    chain: c.sepolia,
    icon: "ethereum",
    alchemy: "eth-sepolia",
    disperse: FEEDFACE_DISPERSE,
  },
  { chain: c.bscTestnet, icon: "binance-smart-chain" },
  {
    chain: c.arbitrumSepolia,
    icon: "arbitrum-one",
    alchemy: "arb-sepolia",
    disperse: FEEDFACE_DISPERSE,
  },
  {
    chain: c.baseSepolia,
    icon: "base",
    alchemy: "base-sepolia",
    disperse: FEEDFACE_DISPERSE,
  },
  { chain: c.polygonAmoy, icon: "polygon", alchemy: "polygon-amoy" },
  {
    chain: c.optimismSepolia,
    icon: "optimism",
    alchemy: "opt-sepolia",
    disperse: FEEDFACE_DISPERSE,
  },
  { chain: c.avalancheFuji, icon: "avalanche", alchemy: "avax-fuji" },
  { chain: c.blastSepolia, icon: "blast", alchemy: "blast-sepolia" },
  { chain: c.lineaSepolia, icon: "linea", alchemy: "linea-sepolia" },
  {
    chain: c.scrollSepolia,
    icon: "scroll",
    alchemy: "scroll-sepolia",
    disperse: FEEDFACE_DISPERSE,
  },
  { chain: c.mantleSepoliaTestnet, icon: "mantle" },
  { chain: c.celoAlfajores, icon: "celo" },
  { chain: c.gnosisChiado },
  { chain: c.fantomTestnet, icon: "fantom" },
  { chain: c.moonbaseAlpha, icon: "moonbase-alpha" },
  { chain: c.cronosTestnet, icon: "cronos" },
  { chain: c.zoraSepolia, icon: "zora", disperse: FEEDFACE_DISPERSE },
  { chain: c.modeTestnet, icon: "mode", disperse: FEEDFACE_DISPERSE },
  { chain: c.fraxtalTestnet, icon: "fraxtal" },
  { chain: c.kavaTestnet, icon: "kava" },
  { chain: c.klaytnBaobab, icon: "kaia" },
  { chain: c.filecoinCalibration, icon: "filecoin" },
  { chain: c.iotexTestnet },
  { chain: c.rootstockTestnet },
  { chain: c.telosTestnet, icon: "telos" },
  { chain: c.bobaSepolia, icon: "boba", disperse: FEEDFACE_DISPERSE },
  { chain: c.flareTestnet, icon: "flare" },
  { chain: c.wemixTestnet },
  { chain: c.bobSepolia, icon: "bob" },
  { chain: c.liskSepolia, icon: "lisk", disperse: FEEDFACE_DISPERSE },
  { chain: c.worldchainSepolia, icon: "world", disperse: FEEDFACE_DISPERSE },
  { chain: c.seiTestnet, icon: "sei-network" },
  { chain: c.taikoHekla, icon: "taiko" },
  { chain: c.berachainBepolia },
  { chain: c.abstractTestnet, icon: "abstract" },
  { chain: c.inkSepolia, icon: "ink" },
  { chain: c.hemiSepolia, icon: "hemi" },
  // ── Local dev ──
  {
    chain: { ...c.hardhat, testnet: true },
  },
] satisfies {
  chain: import("viem").Chain;
  color?: string;
  icon?: string;
  alchemy?: string;
  trust?: string;
  disperse?: string;
}[];

const CHAINLIST_RPCS_JSON = "https://chainlist.org/rpcs.json";

type ChainlistRow = {
  chainId: number;
  rpc?: { url: string }[];
};

/**
 * Load up to `limit` HTTP(S) RPC endpoints per chain from chainlist.org (`rpcs.json`).
 * Used at build time by `gen-chains.ts` (see `pnpm gen`).
 */
export async function fetchPublicRpcUrlsByChainId(limit = 10): Promise<Map<number, string[]>> {
  const res = await fetch(CHAINLIST_RPCS_JSON);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${CHAINLIST_RPCS_JSON}: ${res.status} ${res.statusText}`);
  }
  const rows = (await res.json()) as ChainlistRow[];
  const map = new Map<number, string[]>();
  for (const row of rows) {
    const urls: string[] = [];
    for (const entry of row.rpc ?? []) {
      if (urls.length >= limit) break;
      const u = entry.url;
      if (typeof u !== "string" || (!u.startsWith("https://") && !u.startsWith("http://")))
        continue;
      if (!urls.includes(u)) urls.push(u);
    }
    if (urls.length > 0) map.set(row.chainId, urls);
  }
  return map;
}
