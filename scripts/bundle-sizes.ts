import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import type { RolldownOutput } from "rolldown";
import type { Rollup } from "vite";

type FileSize = { path: string; raw: number };
type SizeEntry = { raw: number; gzip: number; files: FileSize[] };
type DepMap = Map<string, SizeEntry>;

export interface BundleReport {
	label: string;
	outputSize: number;
	gzipSize: number;
	deps: { name: string; raw: number; pct: string; topFiles: FileSize[] }[];
}

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

function bucketInfo(moduleId: string): { dep: string; file: string } {
	const nmIdx = moduleId.lastIndexOf("node_modules/");
	if (nmIdx === -1) return { dep: "(project)", file: moduleId.replace(/^.*\/src\//, "src/") };
	const rest = moduleId.slice(nmIdx + "node_modules/".length);
	const parts = rest.split("/");
	const dep = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
	return { dep, file: `node_modules/${rest}` };
}

function collectModules(
	modules: Record<string, { code: string | null; renderedLength: number }>,
	into: DepMap,
) {
	for (const [id, mod] of Object.entries(modules)) {
		const len = mod.code?.length ?? mod.renderedLength ?? 0;
		if (len === 0) continue;
		const { dep, file } = bucketInfo(id);
		const prev = into.get(dep) ?? { raw: 0, gzip: 0, files: [] };
		prev.raw += len;
		prev.files.push({ path: file, raw: len });
		into.set(dep, prev);
	}
}

const TOP_FILES = 3;
const FILE_MIN_BYTES = 1024;

function buildReport(label: string, deps: DepMap, bundleRaw: number, bundleGzip: number): BundleReport {
	const sorted = [...deps.entries()].sort((a, b) => b[1].raw - a[1].raw);
	const modulesTotal = [...deps.values()].reduce((s, e) => s + e.raw, 0);
	return {
		label,
		outputSize: bundleRaw,
		gzipSize: bundleGzip,
		deps: sorted.map(([name, s]) => ({
			name,
			raw: s.raw,
			pct: ((s.raw / modulesTotal) * 100).toFixed(1),
			topFiles: s.files
				.sort((a, b) => b.raw - a.raw)
				.filter((f) => f.raw >= FILE_MIN_BYTES)
				.slice(0, TOP_FILES),
		})),
	};
}

export async function analyzeRolldown(label: string, output: RolldownOutput): Promise<BundleReport> {
	const deps: DepMap = new Map();
	let totalCode = "";
	for (const item of output.output) {
		if (item.type !== "chunk") continue;
		totalCode += item.code;
		collectModules(item.modules, deps);
	}
	return buildReport(label, deps, totalCode.length, await gzipSize(totalCode));
}

export async function analyzeVite(
	label: string,
	viteResult: Rollup.RollupOutput | Rollup.RollupOutput[],
): Promise<BundleReport> {
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
	return buildReport(label, deps, totalCode.length, await gzipSize(totalCode));
}

export function fmt(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} kB`;
	return `${(kb / 1024).toFixed(2)} MB`;
}

export function formatReport(report: BundleReport): string {
	const lines: string[] = [];
	for (const dep of report.deps) {
		lines.push(`  ${dep.name}  ${fmt(dep.raw)}  ${dep.pct}%`);
		for (const f of dep.topFiles) {
			lines.push(`    └ ${f.path}  ${fmt(f.raw)}`);
		}
	}
	const maxLine = Math.max(...lines.map((l) => l.length), 40);
	const w = maxLine + 2;
	const out: string[] = [];
	out.push("═".repeat(w));
	out.push(`  ${report.label}`);
	out.push(`  output: ${fmt(report.outputSize)} │ gzip: ${fmt(report.gzipSize)}`);
	out.push("─".repeat(w));
	out.push(...lines);
	out.push("═".repeat(w));
	return out.join("\n");
}

export function formatSummaryLine(r: BundleReport): string {
	return `${r.label.padEnd(30)} ${fmt(r.outputSize).padStart(10)}  gzip ${fmt(r.gzipSize).padStart(10)}`;
}
