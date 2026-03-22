import { sendMessage } from "@shared/messages";
import { createResource, createSignal, Show } from "solid-js";
import type { Address } from "viem";

interface TokenImageProps {
  address?: string;
  chainId: number;
  symbol: string;
  color: string;
  size: number;
}

const imageCache = new Map<string, string | null>();

async function fetchTokenImage(source: {
  address: string;
  chainId: number;
}): Promise<string | null> {
  const key = `${source.chainId}:${source.address.toLowerCase()}`;
  if (imageCache.has(key)) return imageCache.get(key)!;

  const res = await sendMessage({
    type: "GET_TOKEN_IMAGE",
    address: source.address as Address,
    chainId: source.chainId,
  });
  const url = res.ok ? res.data.url : null;
  imageCache.set(key, url);
  return url;
}

export function TokenImage(props: TokenImageProps) {
  const [failed, setFailed] = createSignal(false);

  const [url] = createResource(
    () => (props.address ? { address: props.address, chainId: props.chainId } : undefined),
    fetchTokenImage,
    {
      initialValue: (() => {
        if (!props.address) return null;
        const key = `${props.chainId}:${props.address.toLowerCase()}`;
        return imageCache.has(key) ? imageCache.get(key)! : null;
      })(),
    },
  );

  return (
    <Show
      when={url() && !failed()}
      fallback={
        <div
          class="rounded-full flex items-center justify-center text-white font-bold shrink-0"
          style={{
            "background-color": props.color,
            width: `${props.size}px`,
            height: `${props.size}px`,
            "font-size": `${Math.max(props.size * 0.35, 10)}px`,
          }}
        >
          {props.symbol.slice(0, 1)}
        </div>
      }
    >
      <img
        src={url()!}
        alt={props.symbol}
        width={props.size}
        height={props.size}
        loading="lazy"
        class="rounded-full animate-fade-in"
        style={{ width: `${props.size}px`, height: `${props.size}px` }}
        onError={() => setFailed(true)}
      />
    </Show>
  );
}
