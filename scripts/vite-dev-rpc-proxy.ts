import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";

import { DEV_RPC_PROXY_PREFIX, decodeRpcUrlFromDevProxy } from "../src/shared/dev-rpc-proxy";

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
      target = decodeRpcUrlFromDevProxy(segment);
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
          body: body.length > 0 ? body.toString() : undefined,
          redirect: "manual",
        });

        res.statusCode = upstream.status;
        const buf = Buffer.from(await upstream.arrayBuffer());
        upstream.headers.forEach((value, key) => {
          const lk = key.toLowerCase();
          // Node fetch decompresses the body but may still advertise Content-Encoding;
          // forwarding it causes net::ERR_CONTENT_DECODING_FAILED in the browser.
          if (
            lk === "transfer-encoding" ||
            lk === "connection" ||
            lk === "content-encoding" ||
            lk === "content-length"
          ) {
            return;
          }
          res.setHeader(key, value);
        });
        res.end(buf);
      } catch (e) {
        res.statusCode = 502;
        res.end(e instanceof Error ? e.message : "RPC proxy error");
      }
    })();
  };
}
