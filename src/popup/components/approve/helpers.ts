import { Gauge, Rocket, Zap } from "lucide-solid";

export const GAS_ICONS = { slow: Gauge, normal: Zap, fast: Rocket } as const;
export const GAS_LABELS = { slow: "Slow", normal: "Normal", fast: "Fast" } as const;

export function formatGasCost(ethCost: string, nativeUsdPrice: number | null | undefined): string {
  const eth = parseFloat(ethCost);
  if (nativeUsdPrice && nativeUsdPrice > 0) {
    const usd = eth * nativeUsdPrice;
    return usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`;
  }
  return `${eth.toFixed(6)} ETH`;
}

export function scrollEndIntoView(el: HTMLElement | undefined | null) {
  requestAnimationFrame(() => {
    if (!el) return;
    const container = el.closest(".overflow-y-auto");
    if (!container) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const elBottom = elRect.bottom - containerRect.top + container.scrollTop;
    const target = elBottom - container.clientHeight + 8;
    if (target > container.scrollTop) {
      container.scrollTo({ top: target, behavior: "smooth" });
    }
  });
}

export function decodeMessage(method: string, params: unknown[]): string {
  if (method === "personal_sign") {
    const hex = params[0] as string;
    if (hex.startsWith("0x")) {
      try {
        const bytes = [];
        for (let i = 2; i < hex.length; i += 2) {
          bytes.push(parseInt(hex.substring(i, i + 2), 16));
        }
        return new TextDecoder().decode(new Uint8Array(bytes));
      } catch {
        return hex;
      }
    }
    return hex;
  }

  if (method === "eth_sign") {
    return params[1] as string;
  }

  if (method === "eth_signTypedData_v4" || method === "eth_signTypedData") {
    try {
      const data = typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];
      return JSON.stringify(data, null, 2);
    } catch {
      return String(params[1]);
    }
  }

  return JSON.stringify(params, null, 2);
}

export function getMethodLabel(method: string): string {
  switch (method) {
    case "personal_sign":
      return "Personal Sign";
    case "eth_sign":
      return "Eth Sign";
    case "eth_signTypedData_v4":
    case "eth_signTypedData":
      return "Typed Data";
    default:
      return "Sign";
  }
}
