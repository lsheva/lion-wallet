import { rmSync, cpSync, existsSync } from "node:fs";
import { build as viteBuild } from "vite";
import { build as esbuild } from "esbuild";

rmSync("dist", { recursive: true, force: true });

await viteBuild();

const shared = { bundle: true, platform: "browser" as const, target: "es2020" };
await Promise.all([
  esbuild({
    ...shared,
    entryPoints: ["src/background/index.ts"],
    outfile: "dist/background.js",
    format: "esm",
  }),
  esbuild({
    ...shared,
    entryPoints: ["src/content/index.ts"],
    outfile: "dist/content-script.js",
    format: "iife",
  }),
  esbuild({
    ...shared,
    entryPoints: ["src/inpage/provider.ts"],
    outfile: "dist/inpage.js",
    format: "iife",
  }),
]);

cpSync("src/manifest.json", "dist/manifest.json");

if (existsSync("src/icons/generated")) {
  cpSync("src/icons/generated", "dist/icons", { recursive: true });
}

console.log("Build complete.");
