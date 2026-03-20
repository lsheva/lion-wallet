import { decodeFunctionData, decodeAbiParameters, type Abi, type Hex } from "viem";
import type { DecodedCall, DecodedArg } from "../shared/types";
import type { TransactionParams } from "../shared/types";
import { fetchContractAbi, resolveImplementation } from "./etherscan";

export function stringify(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return `[${value.map(stringify).join(", ")}]`;
  return String(value);
}

export function tryDecode(abi: unknown[], data: Hex): DecodedCall | null {
  const { functionName, args } = decodeFunctionData({ abi: abi as Abi, data });

  const abiItem = (abi as Array<{ type?: string; name?: string; inputs?: Array<{ name: string; type: string }> }>)
    .find((item) => item.type === "function" && item.name === functionName);

  const decodedArgs: DecodedArg[] = (args ?? []).map((val, i) => ({
    name: abiItem?.inputs?.[i]?.name ?? `arg${i}`,
    type: abiItem?.inputs?.[i]?.type ?? "unknown",
    value: stringify(val),
  }));

  return { functionName, args: decodedArgs };
}

async function decodeViaEtherscan(
  to: string,
  data: Hex,
  chainId: number,
  log: string[],
): Promise<DecodedCall | null> {
  log.push(`etherscan: looking up ABI for ${to} on chain ${chainId}`);
  const abi = await fetchContractAbi(to, chainId, log);
  if (!abi) {
    log.push("etherscan: no ABI returned");
    return null;
  }
  log.push(`etherscan: got ABI with ${abi.length} entries`);

  try {
    const result = tryDecode(abi, data);
    if (result) {
      log.push(`etherscan: decoded ${result.functionName}(${result.args.length} args)`);
      return result;
    }
  } catch (e) {
    log.push(`etherscan: decode with direct ABI failed: ${e instanceof Error ? e.message : e}`);
  }

  // Selector not in ABI — likely a proxy. Resolve implementation and try its ABI.
  log.push("etherscan: selector not in ABI, resolving proxy implementation");
  const impl = await resolveImplementation(to, chainId, log);
  if (!impl) {
    log.push("etherscan: no implementation found");
    return null;
  }

  log.push(`etherscan: fetching implementation ABI from ${impl}`);
  const implAbi = await fetchContractAbi(impl, chainId, log);
  if (!implAbi) {
    log.push("etherscan: no implementation ABI returned");
    return null;
  }
  log.push(`etherscan: got implementation ABI with ${implAbi.length} entries`);

  try {
    const result = tryDecode(implAbi, data);
    if (result) {
      log.push(`etherscan: decoded via impl ${result.functionName}(${result.args.length} args)`);
      return result;
    }
  } catch (e) {
    log.push(`etherscan: decode with impl ABI also failed: ${e instanceof Error ? e.message : e}`);
  }

  return null;
}

function parseTextSignature(textSig: string): { name: string; types: string[] } | null {
  const match = textSig.match(/^([^(]+)\(([^)]*)\)$/);
  if (!match) return null;
  const name = match[1];
  const types = match[2] ? match[2].split(",").map((t) => t.trim()) : [];
  return { name, types };
}

async function decodeVia4byte(data: Hex, log: string[]): Promise<DecodedCall | null> {
  if (data.length < 10) return null;
  const selector = data.slice(0, 10);

  try {
    const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=${selector}&ordering=created_at`;
    log.push(`4byte: fetching ${selector}`);
    const resp = await fetch(url);
    log.push(`4byte: HTTP ${resp.status} ${resp.statusText}`);
    if (!resp.ok) return null;
    const json = (await resp.json()) as { count?: number; results?: Array<{ text_signature: string }> };
    log.push(`4byte: ${json.count ?? 0} results, first: ${json.results?.[0]?.text_signature ?? "none"}`);
    const sig = json.results?.[0]?.text_signature;
    if (!sig) return null;

    const parsed = parseTextSignature(sig);
    if (!parsed) return { functionName: sig, args: [] };

    if (parsed.types.length === 0) {
      return { functionName: parsed.name, args: [] };
    }

    const calldataHex = `0x${data.slice(10)}` as Hex;
    const paramDefs = parsed.types.map((type) => ({ type, name: "" }));

    try {
      const decoded = decodeAbiParameters(paramDefs, calldataHex);
      const args: DecodedArg[] = decoded.map((val, i) => ({
        name: `param${i}`,
        type: parsed.types[i],
        value: stringify(val),
      }));
      log.push(`4byte: decoded ${parsed.name}(${args.length} args)`);
      return { functionName: parsed.name, args };
    } catch (e) {
      log.push(`4byte: param decode failed: ${e instanceof Error ? e.message : e}`);
      return { functionName: parsed.name, args: [] };
    }
  } catch (e) {
    log.push(`4byte: fetch failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

export type DecodeSource = "etherscan" | "4byte" | "selector";

export interface DecodeResult {
  decoded: DecodedCall | null;
  via: DecodeSource | null;
}

export async function decodeTx(
  txParams: TransactionParams,
  chainId: number,
  log: string[] = [],
): Promise<DecodeResult> {
  if (!txParams.data || txParams.data === "0x" || txParams.data.length < 10) {
    log.push("decode: no calldata");
    return { decoded: null, via: null };
  }

  const etherscanResult = await decodeViaEtherscan(txParams.to, txParams.data, chainId, log);
  if (etherscanResult) return { decoded: etherscanResult, via: "etherscan" };

  const fourByteResult = await decodeVia4byte(txParams.data, log);
  if (fourByteResult) return { decoded: fourByteResult, via: "4byte" };

  log.push(`decode: all methods failed, using raw selector ${txParams.data.slice(0, 10)}`);
  return {
    decoded: { functionName: txParams.data.slice(0, 10), args: [] },
    via: "selector",
  };
}
