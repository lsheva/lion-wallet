import { sendMessage } from "@shared/messages";
import { createEffect, createSignal, on, Switch, Match } from "solid-js";
import type { Address } from "viem";

interface TokenImageProps {
  address?: string;
  chainId: number;
  symbol: string;
  color: string;
  size: number;
}

type ImageState = "loading" | "loaded" | "miss";

const imageCache = new Map<string, string | null>();

async function fetchTokenImage(chainId: number, address: string): Promise<string | null> {
  const key = `${chainId}:${address.toLowerCase()}`;
  const cached = imageCache.get(key);
  if (cached !== undefined) return cached;

  const res = await sendMessage({
    type: "GET_TOKEN_IMAGE",
    address: address as Address,
    chainId,
  });
  const url = res.ok ? res.data.url : null;
  imageCache.set(key, url);
  return url;
}

export function TokenImage(props: TokenImageProps) {
  const [dataUrl, setDataUrl] = createSignal<string | null>(null);
  const [state, setState] = createSignal<ImageState>("loading");

  createEffect(
    on(
      () => [props.address, props.chainId] as const,
      ([address, chainId]) => {
        if (!address) {
          setState("miss");
          return;
        }

        const key = `${chainId}:${address.toLowerCase()}`;
        const cached = imageCache.get(key);
        if (cached !== undefined) {
          if (cached) {
            setDataUrl(cached);
            setState("loaded");
          } else {
            setState("miss");
          }
          return;
        }

        setState("loading");
        fetchTokenImage(chainId, address).then((url) => {
          if (url) {
            setDataUrl(url);
            setState("loaded");
          } else {
            setState("miss");
          }
        });
      },
    ),
  );

  const sz = () => `${props.size}px`;
  const fontSize = () => `${Math.max(props.size * 0.35, 10)}px`;

  return (
    <Switch>
      <Match when={state() === "loading"}>
        <div
          class="rounded-full shrink-0 animate-shimmer"
          style={{ width: sz(), height: sz() }}
        />
      </Match>
      <Match when={state() === "loaded"}>
        <img
          src={dataUrl()!}
          alt={props.symbol}
          width={props.size}
          height={props.size}
          class="rounded-full shrink-0"
          style={{ width: sz(), height: sz() }}
          onError={() => setState("miss")}
        />
      </Match>
      <Match when={state() === "miss"}>
        <div
          class="rounded-full shrink-0 flex items-center justify-center text-white font-bold"
          style={{
            "background-color": props.color,
            width: sz(),
            height: sz(),
            "font-size": fontSize(),
          }}
        >
          {props.symbol.slice(0, 1)}
        </div>
      </Match>
    </Switch>
  );
}
