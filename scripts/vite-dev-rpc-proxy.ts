import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";

import { DEV_RPC_PROXY_PREFIX } from "../src/shared/dev-rpc-proxy";

function decodeBase64UrlSegment(segment: string): string {
  let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return Buffer.from(b64, "base64").toString("utf8");
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Forwards JSON-RPC (and similar) POSTs to any http(s) URL so tab + dev SW avoid CORS.
 * Only mounted on the Vite dev server (localhost).
 */
export function devRpcProxyMiddleware(): Connect.NextHandleFunction {
  return (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const url = req.url ?? "";
    if (!url.startsWith(DEV_RPC_PROXY_PREFIX)) {
      next();
      return;
    }

    const pathOnly = url.split("?")[0] ?? "";
    const segment = pathOnly.slice(DEV_RPC_PROXY_PREFIX.length);
    if (!segment) {
      next();
      return;
    }

    let target: string;
    try {
      target = decodeBase64UrlSegment(decodeURIComponent(segment));
    } catch {
      res.statusCode = 400;
      res.end("Invalid __dev_rpc target encoding");
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      res.statusCode = 400;
      res.end("Invalid __dev_rpc target URL");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      res.statusCode = 400;
      res.end("Invalid __dev_rpc protocol (only http/https)");
      return;
    }

    void (async () => {
      try {
        const body = await readBody(req);
        const forwardHeaders = new Headers();
        const ct = req.headers["content-type"];
        if (typeof ct === "string") forwardHeaders.set("content-type", ct);
        else if (Array.isArray(ct) && ct[0]) forwardHeaders.set("content-type", ct[0]);

        const upstream = await fetch(target, {
          method: req.method ?? "POST",
          headers: forwardHeaders,
          body: body.length > 0 ? body : undefined,
          redirect: "manual",
        });

        res.statusCode = upstream.status;
        upstream.headers.forEach((value, key) => {
          const lk = key.toLowerCase();
          if (lk === "transfer-encoding" || lk === "connection") return;
          res.setHeader(key, value);
        });
        res.end(Buffer.from(await upstream.arrayBuffer()));
      } catch (e) {
        res.statusCode = 502;
        res.end(e instanceof Error ? e.message : "RPC proxy error");
      }
    })();
  };
}
