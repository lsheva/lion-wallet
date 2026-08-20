import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { optimize } from "svgo";

const FILES: [source: string, output: string][] = [
  ["src/icons/icon.svg", "src/icons/icon.generated.svg"],
];

if (FILES.every(([, output]) => existsSync(output))) {
  console.log("Optimized SVG already present — skipping.");
  process.exit(0);
}

for (const [source, output] of FILES) {
  const raw = readFileSync(source, "utf8");
  const result = optimize(raw, {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            cleanupIds: false,
          },
        },
      },
    ],
  });
  writeFileSync(output, result.data);
  const saved = raw.length - result.data.length;
  console.log(
    `${basename(source)}: ${raw.length} → ${result.data.length} (−${saved})`,
  );
}
