import { sendMessage } from "@shared/messages";
import { useEffect, useState } from "preact/hooks";
import type { Address } from "viem";

interface TokenImageProps {
  address?: string;
  chainId: number;
  symbol: string;
  color: string;
  size: number;
}

const imageCache = new Map<string, string | null>();

export function TokenImage({ address, chainId, symbol, color, size }: TokenImageProps) {
  const [url, setUrl] = useState<string | null | undefined>(() => {
    if (!address) return undefined;
    const key = `${chainId}:${address.toLowerCase()}`;
    return imageCache.has(key) ? imageCache.get(key) : undefined;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!address) return;
    const key = `${chainId}:${address.toLowerCase()}`;

    if (imageCache.has(key)) {
      setUrl(imageCache.get(key));
      return;
    }

    let cancelled = false;
    sendMessage({
      type: "GET_TOKEN_IMAGE",
      address: address as Address,
      chainId,
    }).then((res) => {
      if (cancelled) return;
      const imageUrl = res.ok ? res.data.url : null;
      imageCache.set(key, imageUrl);
      setUrl(imageUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [address, chainId]);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={symbol}
        width={size}
        height={size}
        loading="lazy"
        class="rounded-full animate-fade-in"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      class="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: Math.max(size * 0.35, 10),
      }}
    >
      {symbol.slice(0, 1)}
    </div>
  );
}
