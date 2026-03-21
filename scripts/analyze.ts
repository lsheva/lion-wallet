import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import { build, type RolldownOutput } from "rolldown";
import { build as viteBuild, type Rollup } from "vite";

type SizeEntry = { raw: number; gzip: number };
type DepMap = Map<string, SizeEntry>;

async function gzipSize(code: string): Promise<number> {
	return new Promise((resolve, reject) => {
		let size = 0;
		const gzip = createGzip({ level: 9 });
		gzip.on("data", (chunk: Buffer) => (size += chunk.length));
		gzip.on("end", () => resolve(size));
		gzip.on("error", reject);
		Readable.from([code]).pipe(gzip);
	});
}

function bucketName(moduleId: string): string {
	const nmIdx = moduleId.lastIndexOf("node_modules/");
	if (nmIdx === -1) return "(project)";
	const rest = moduleId.slice(nmIdx + "node_modules/".length);
	const parts = rest.split("/");
	return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

function collectModules(
	modules: Record<string, { code: string | null; renderedLength: number }>,
	into: DepMap,
) {
	for (const [id, mod] of Object.entries(modules)) {
		const len = mod.code?.length ?? mod.renderedLength ?? 0;
		if (len === 0) continue;
		const dep = bucketName(id);
		const prev = into.get(dep) ?? { raw: 0, gzip: 0 };
		prev.raw += len;
		into.set(dep, prev);
	}
}

function fmt(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} kB`;
	return `${(kb / 1024).toFixed(2)} MB`;
}

function printTable(
	label: string,
	deps: DepMap,
	bundleRaw: number,
	bundleGzip: number,
) {
	const sorted = [...deps.entries()].sort((a, b) => b[1].raw - a[1].raw);
	const maxName = Math.max(...sorted.map(([n]) => n.length), 8);
	const modulesTotal = [...deps.values()].reduce((s, e) => s + e.raw, 0);
	const w = maxName + 34;

	console.log(`\n${"═".repeat(w)}`);
	console.log(`  ${label}`);
	console.log(`  output: ${fmt(bundleRaw)} │ gzip: ${fmt(bundleGzip)}`);
	console.log(`${"─".repeat(w)}`);
	console.log(
		`  ${"Dependency".padEnd(maxName)}  ${"Size".padStart(10)}  ${"% bundle".padStart(10)}`,
	);
	console.log(`${"─".repeat(w)}`);

	for (const [name, s] of sorted) {
		const pct = ((s.raw / modulesTotal) * 100).toFixed(1);
		console.log(
			`  ${name.padEnd(maxName)}  ${fmt(s.raw).padStart(10)}  ${(pct + "%").padStart(10)}`,
		);
	}
	console.log(`${"═".repeat(w)}`);
}

async function analyzeRolldownOutput(label: string, output: RolldownOutput) {
	const deps: DepMap = new Map();
	let totalCode = "";

	for (const item of output.output) {
		if (item.type !== "chunk") continue;
		totalCode += item.code;
		collectModules(item.modules, deps);
	}

	const totalGzip = await gzipSize(totalCode);
	printTable(label, deps, totalCode.length, totalGzip);
}

async function analyzeViteOutput(
	label: string,
	viteResult: Rollup.RollupOutput | Rollup.RollupOutput[],
) {
	const outputs = Array.isArray(viteResult) ? viteResult : [viteResult];
	const deps: DepMap = new Map();
	let totalCode = "";

	for (const result of outputs) {
		for (const item of result.output) {
			if (item.type !== "chunk") continue;
			totalCode += item.code;
			collectModules(item.modules, deps);
		}
	}

	const totalGzip = await gzipSize(totalCode);
	printTable(label, deps, totalCode.length, totalGzip);
}

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

await analyzeViteOutput("Popup (Vite)", popupResult);
await analyzeRolldownOutput("Background (Rolldown)", bgResult);
await analyzeRolldownOutput("Content Script (Rolldown)", contentResult);
await analyzeRolldownOutput("Inpage Provider (Rolldown)", inpageResult);
