import { BaseError, ContractFunctionRevertedError } from "viem";

function formatContractFunctionReverted(rev: ContractFunctionRevertedError): string {
  const lines: string[] = [];
  if (rev.reason) lines.push(`Reason: ${rev.reason}`);
  if (rev.signature) lines.push(`Unknown selector: ${rev.signature}`);
  if (rev.raw) lines.push(`Raw data: ${rev.raw}`);
  if (rev.data && typeof rev.data === "object" && rev.data !== null && "errorName" in rev.data) {
    const d = rev.data as { errorName: string; args?: readonly unknown[] };
    const argsStr = d.args && d.args.length > 0 ? `(${d.args.map(formatArg).join(", ")})` : "";
    lines.push(`Decoded: ${d.errorName}${argsStr}`);
  }
  return lines.join("\n");
}

function formatArg(a: unknown): string {
  if (typeof a === "bigint") return a.toString();
  if (typeof a === "string" && a.startsWith("0x") && a.length === 42) return a;
  return String(a);
}

/**
 * Uses viem's {@link ContractFunctionRevertedError} from `simulateContract` / contract call errors
 * (`BaseError.walk` → `reason`, `signature`, `raw`, decoded `data`).
 */
export function formatRevertFingerprintForDisplay(e: unknown): string | null {
  if (!(e instanceof BaseError)) return null;
  const rev = e.walk((err) => err instanceof ContractFunctionRevertedError);
  if (!(rev instanceof ContractFunctionRevertedError)) return null;
  const formatted = formatContractFunctionReverted(rev);
  return formatted.trim() ? formatted : null;
}
