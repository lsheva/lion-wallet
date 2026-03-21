import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { build, type RolldownOutput } from "rolldown";
import { type Rollup, build as viteBuild } from "vite";
import { analyzeRolldown, analyzeVite, formatReport, formatSummaryLine } from "./bundle-sizes.ts";

rmSync("dist", { recursive: true, force: true });

const popupResult = (await viteBuild()) as Rollup.RollupOutput;

const shared: Rollup.BuildOptions = {
  platform: "browser",
  experimental: { lazyBarrel: true, nativeMagicString: true },
  optimization: {
    inlineConst: {
      mode: "all",
      pass: 1000,
    },
  },
  treeshake: {
    propertyReadSideEffects: false,
  },
};

const sharedOutput: Rollup.OutputOptions = {
  minify: true,
  codeSplitting: false,
  comments: false,
  minifyInternalExports: true,
};
const [bgResult, contentResult, inpageResult] = await Promise.all([
  build({
    ...shared,
    input: "src/background/index.ts",
    output: {
      ...sharedOutput,
      file: "dist/background.js",
      format: "esm",
    },
  }),
  build({
    ...shared,
    input: "src/content/index.ts",
    output: {
      ...sharedOutput,
      file: "dist/content-script.js",
      format: "iife",
    },
  }),
  build({
    ...shared,
    input: "src/inpage/provider.ts",
    output: {
      ...sharedOutput,
      file: "dist/inpage.js",
      format: "iife",
    },
    moduleTypes: { ".svg": "text" },
  }),
]);

cpSync("src/manifest.json", "dist/manifest.json");

if (!existsSync("src/icons/generated")) {
  console.error("Error: src/icons/generated missing. Run `pnpm icons` first.");
  process.exit(1);
}
cpSync("src/icons/generated", "dist/icons", { recursive: true });

const reports = await Promise.all([
  analyzeVite("Popup", popupResult),
  analyzeRolldown("Background", bgResult as RolldownOutput),
  analyzeRolldown("Content Script", contentResult as RolldownOutput),
  analyzeRolldown("Inpage", inpageResult as RolldownOutput),
]);

const detailed = reports.map(formatReport).join("\n\n");
const summary = reports.map(formatSummaryLine).join("\n");
writeFileSync("bundle-sizes.txt", `${detailed}\n`);
console.log(`\n${summary}\n`);
console.log("Build complete.");
