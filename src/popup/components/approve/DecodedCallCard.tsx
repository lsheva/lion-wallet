import { truncateAddress } from "@shared/format";
import type { DecodedCall } from "@shared/types";
import { ChevronDown, ChevronUp, FileCode } from "lucide-preact";
import type { RefObject } from "preact";
import { Card } from "../Card";
import { CopyButton } from "../CopyButton";
import { scrollEndIntoView } from "./helpers";

const COLLAPSED_ARGS = 3;

function formatArgValue(value: string, type: string): string {
  if (type === "address") return `${value.slice(0, 6)}...${value.slice(-4)}`;
  if (value.length > 12) return `${value.slice(0, 8)}...${value.slice(-4)}`;
  return value;
}

export function DecodedCallCard({
  decoded,
  toAddress,
  argsExpanded,
  setArgsExpanded,
  argsRef,
}: {
  decoded: DecodedCall;
  toAddress: string;
  argsExpanded: boolean;
  setArgsExpanded: (v: boolean) => void;
  argsRef: RefObject<HTMLButtonElement>;
}) {
  return (
    <Card>
      <p class="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-2.5">
        Contract Action
      </p>
      <div class="space-y-2.5">
        <div class="flex items-center gap-2">
          <FileCode size={16} class="text-accent shrink-0" />
          <p class="font-mono text-sm font-semibold text-accent truncate">
            {decoded.functionName}()
          </p>
        </div>

        {decoded.args.length > 0 && (
          <button
            type="button"
            ref={argsRef}
            class="bg-base rounded-[var(--radius-chip)] divide-y divide-divider cursor-pointer w-full text-left"
            onClick={() => {
              const expanding = !argsExpanded;
              setArgsExpanded(expanding);
              if (expanding && argsRef.current) scrollEndIntoView(argsRef);
            }}
          >
            {(argsExpanded ? decoded.args : decoded.args.slice(0, COLLAPSED_ARGS)).map((arg) => (
              <div key={arg.name} class="flex items-center justify-between px-3 py-2">
                <span class="text-xs text-text-secondary shrink-0">{arg.name}</span>
                <span class="font-mono text-xs text-text-primary text-right">
                  {formatArgValue(arg.value, arg.type)}
                </span>
              </div>
            ))}
            {decoded.args.length > COLLAPSED_ARGS && (
              <div class="flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] text-accent">
                {argsExpanded ? (
                  <>
                    <ChevronUp size={12} /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} /> {decoded.args.length - COLLAPSED_ARGS} more
                  </>
                )}
              </div>
            )}
          </button>
        )}

        <div class="flex items-center justify-between pt-1.5 border-t border-divider">
          <span class="text-xs text-text-secondary">Interacting with</span>
          <span class="inline-flex items-center gap-1 font-mono text-xs text-text-primary">
            {decoded.contractName ? (
              <>
                {decoded.contractName}{" "}
                <span class="text-text-tertiary">({truncateAddress(toAddress)})</span>
              </>
            ) : (
              truncateAddress(toAddress)
            )}
            <CopyButton text={toAddress} size={12} />
          </span>
        </div>
      </div>
    </Card>
  );
}
