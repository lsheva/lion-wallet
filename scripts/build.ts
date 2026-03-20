import { cpSync, existsSync, rmSync } from "node:fs";
import { build } from "rolldown";
import { build as viteBuild } from "vite";

rmSync("dist", { recursive: true, force: true });

await viteBuild();

const shared = { platform: "browser" as const };
await Promise.all([
  build({
    ...shared,
    input: "src/background/index.ts",
    output: { file: "dist/background.js", format: "esm", minify: true, codeSplitting: false },
  }),
  build({
    ...shared,
    input: "src/content/index.ts",
    output: { file: "dist/content-script.js", format: "iife", minify: true, codeSplitting: false },
  }),
  build({
    ...shared,
    input: "src/inpage/provider.ts",
    output: { file: "dist/inpage.js", format: "iife", minify: true, codeSplitting: false },
    moduleTypes: { ".svg": "text" },
  }),
]);

cpSync("src/manifest.json", "dist/manifest.json");

if (!existsSync("src/icons/generated")) {
  console.error("Error: src/icons/generated missing. Run `pnpm icons` first.");
  process.exit(1);
}
cpSync("src/icons/generated", "dist/icons", { recursive: true });

console.log("Build complete.");
