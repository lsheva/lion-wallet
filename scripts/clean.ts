import { rmSync } from "node:fs";

const generated = [
  "src/shared/chains.generated.ts",
  "src/popup/chain-ui.generated.ts",
  "src/icons/icon.generated.svg",
  "src/icons/generated",
  "dist",
];

for (const path of generated) {
  rmSync(path, { recursive: true, force: true });
  console.log(`removed ${path}`);
}
