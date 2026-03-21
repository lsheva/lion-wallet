import { writeFileSync } from "node:fs";
import type { Chain } from "viem";
import * as allChains from "viem/chains";
import list from "./chain-list.ts";

const viemName = new Map<number, string>();
for (const [name, chain] of Object.entries(allChains)) {
  if (chain && typeof chain === "object" && "id" in chain) {
    viemName.set((chain as Chain).id, name);
  }
}
for (const { chain } of list) {
  const match = Object.entries(allChains).find(([, v]) => v === chain);
  if (match) viemName.set(chain.id, match[0]);
}

function minimal(chain: Chain, alchemy?: string) {
  const o: Record<string, unknown> = {
    id: chain.id,
    name: chain.name,
    nativeCurrency: chain.nativeCurrency,
  };
  if (chain.testnet) o.testnet = true;
  if (chain.rpcUrls?.default?.http?.[0]) o.rpcUrl = chain.rpcUrls.default.http[0];
  if (chain.blockExplorers?.default?.url) o.blockExplorerUrl = chain.blockExplorers.default.url;
  if (alchemy) o.alchemySlug = alchemy;
  return o;
}

// ── Shared: chain metadata only ──

const ids: string[] = [];
const chains: string[] = [];

for (const { chain, alchemy } of list) {
  const key = viemName.get(chain.id) ?? `chain${chain.id}`;
  ids.push(`  ${key}: ${chain.id},`);
  chains.push(`  ${JSON.stringify(minimal(chain, alchemy))},`);
}

const shared = `// @generated — do not edit. Regenerate with \`pnpm gen:chains\`
import type { ChainMeta } from "./types";

export const CHAIN = {
${ids.join("\n")}
} as const;

export const CHAINS: ChainMeta[] = [
${chains.join("\n")}
];

export const CHAIN_BY_ID = new Map(CHAINS.map((c) => [c.id, c]));
`;

writeFileSync("src/shared/chains.generated.ts", shared);

// ── Popup: icons + colors ──

const iconSlugs = [...new Set(list.map((e) => e.icon).filter(Boolean))] as string[];
const slugToVar = new Map<string, string>();

const imports: string[] = [];
for (let i = 0; i < iconSlugs.length; i++) {
  const slug = iconSlugs[i];
  const varName = `i${i}`;
  slugToVar.set(slug, varName);
  imports.push(`import ${varName} from "@web3icons/core/svgs/networks/branded/${slug}.svg.js";`);
}

const iconEntries: string[] = [];
const colorEntries: string[] = [];

for (const { chain, icon, color } of list) {
  if (icon) iconEntries.push(`  [${chain.id}, ${slugToVar.get(icon)}],`);
  if (color) colorEntries.push(`  [${chain.id}, ${JSON.stringify(color)}],`);
}

const popup = `// @generated — do not edit. Regenerate with \`pnpm gen:chains\`
${imports.join("\n")}

export const CHAIN_ICON_BY_ID = new Map<number, string>([
${iconEntries.join("\n")}
]);

export const CHAIN_COLOR_BY_ID = new Map<number, string>([
${colorEntries.join("\n")}
]);
`;

writeFileSync("src/popup/chain-ui.generated.ts", popup);

console.log(`Generated ${list.length} chains → src/shared/chains.generated.ts`);
console.log(
  `Generated ${iconEntries.length} icons, ${colorEntries.length} colors → src/popup/chain-ui.generated.ts`,
);
