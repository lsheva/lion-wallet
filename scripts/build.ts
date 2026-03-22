import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { build, type RolldownOutput } from "rolldown";
import { type Rollup, build as viteBuild } from "vite";
import { analyzeRolldown, analyzeVite, formatReport, formatSummaryLine } from "./bundle-sizes.ts";

const isChrome = process.argv.includes("--chrome");
const chromeBanner = isChrome
  ? readFileSync("node_modules/webextension-polyfill/dist/browser-polyfill.min.js", "utf8")
  : "";

rmSync("dist", { recursive: true, force: true });

if (!existsSync("src/shared/chains.generated.ts")) {
  await import("./gen-chains.ts");
}
if (!existsSync("src/icons/icon.generated.svg")) {
  await import("./optimize-svg.ts");
}

const popupResult = (await viteBuild({
  build: isChrome ? { rollupOptions: { output: { banner: chromeBanner } } } : undefined,
})) as Rollup.RollupOutput;

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
      ...(isChrome && { banner: chromeBanner }),
    },
  }),
  build({
    ...shared,
    input: "src/content/index.ts",
    output: {
      ...sharedOutput,
      file: "dist/content-script.js",
      format: "iife",
      ...(isChrome && { banner: chromeBanner }),
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

cpSync(
  isChrome ? "src/manifest.chrome.json" : "src/manifest.json",
  "dist/manifest.json",
);

if (!existsSync("src/icons/generated")) {
  await import("./icons.ts");
}
cpSync("src/icons/generated", "dist/icons", { recursive: true });

if (isChrome) {
  rmSync("build/chrome", { recursive: true, force: true });
  cpSync("dist", "build/chrome", { recursive: true });

  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const zipName = `lion-wallet-chrome-${version}.zip`;
  rmSync(`build/${zipName}`, { force: true });
  execSync(`cd build/chrome && zip -r ../${zipName} .`);
  console.log(`Chrome extension → build/${zipName}`);
}

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
