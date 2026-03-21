import { build } from "rolldown";
import { type Rollup, build as viteBuild } from "vite";
import { analyzeRolldown, analyzeVite, formatReport } from "./bundle-sizes.ts";

console.log("\nBuilding & analyzing bundle sizes...\n");

const shared = { platform: "browser" as const };

const [popupResult, bgResult, contentResult, inpageResult] = await Promise.all([
  viteBuild({ logLevel: "warn" }) as Promise<Rollup.RollupOutput>,
  build({
    ...shared,
    write: false,
    input: "src/background/index.ts",
    output: { file: "dist/background.js", format: "esm", minify: true, codeSplitting: false },
  }),
  build({
    ...shared,
    write: false,
    input: "src/content/index.ts",
    output: {
      file: "dist/content-script.js",
      format: "iife",
      minify: true,
      codeSplitting: false,
    },
  }),
  build({
    ...shared,
    write: false,
    input: "src/inpage/provider.ts",
    output: { file: "dist/inpage.js", format: "iife", minify: true, codeSplitting: false },
    moduleTypes: { ".svg": "text" },
  }),
]);

const reports = await Promise.all([
  analyzeVite("Popup (Vite)", popupResult),
  analyzeRolldown("Background (Rolldown)", bgResult),
  analyzeRolldown("Content Script (Rolldown)", contentResult),
  analyzeRolldown("Inpage Provider (Rolldown)", inpageResult),
]);

for (const r of reports) console.log(`\n${formatReport(r)}`);
