import { getIdentityKey } from "./stage.ts";
import {
  HostUnconfiguredError,
  HostUrlInvalidError,
  buildHostTarget,
  resolveHostUrl,
  type EnvMap,
} from "./host.ts";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "cookie",
]);

const FORWARD_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "if-none-match",
  "if-modified-since",
]);

const FORWARD_RESPONSE_HEADERS = new Set([
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
  "x-request-id",
]);

export const HOST_PROXY_TIMEOUT_MS = 30_000;

export type ProxyDeps = {
  fetch?: typeof fetch;
  env?: EnvMap;
  now?: () => number;
};

export function hostUnconfiguredPayload() {
  return {
    error: "host_unconfigured" as const,
    product: "WorkerLayer",
    surface: "vercel-desk",
    message:
      "WORKERLAYER_HOST_URL is not set. Vercel must point this desk at the Mac mini host. This process does not run Workers, startTask, or Manifest exec.",
  };
}

function copyRequestHeaders(source: Headers, env: EnvMap): Headers {
  const headers = new Headers();

  for (const [key, value] of source.entries()) {
    const name = key.toLowerCase();
    if (HOP_BY_HOP.has(name)) continue;
    if (name.startsWith("x-workerlayer-") || FORWARD_REQUEST_HEADERS.has(name)) {
      headers.set(key, value);
    }
  }

  headers.set("x-workerlayer-surface", "vercel-desk");
  headers.set("x-workerlayer-key-kind", "identity-only");

  const identity = getIdentityKey(env);
  if (identity) {
    headers.set("x-workerlayer-identity", identity);
  }

  return headers;
}

function copyResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  for (const [key, value] of source.entries()) {
    if (FORWARD_RESPONSE_HEADERS.has(key.toLowerCase()) || key.toLowerCase().startsWith("x-workerlayer-")) {
      headers.set(key, value);
    }
  }
  headers.set("x-workerlayer-proxied", "1");
  return headers;
}

export async function proxyToHost(
  request: Request,
  path: string,
  deps: ProxyDeps = {},
): Promise<Response> {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetch ?? fetch;

  let host: URL;
  try {
    host = resolveHostUrl(env);
  } catch (error) {
    if (error instanceof HostUnconfiguredError) {
      return Response.json(hostUnconfiguredPayload(), { status: 503 });
    }
    if (error instanceof HostUrlInvalidError) {
      return Response.json(
        { error: error.code, message: error.message, surface: "vercel-desk" },
        { status: 500 },
      );
    }
    throw error;
  }

  const incoming = new URL(request.url);
  let target: URL;
  try {
    target = buildHostTarget(host, path, incoming.search);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid host target";
    return Response.json({ error: "host_url_invalid", message }, { status: 400 });
  }

  const method = request.method.toUpperCase();
  const headers = copyRequestHeaders(request.headers, env);
  const body =
    method === "GET" || method === "HEAD" || method === "OPTIONS"
      ? undefined
      : await request.arrayBuffer();

  try {
    const upstream = await fetchImpl(target, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(HOST_PROXY_TIMEOUT_MS),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: copyResponseHeaders(upstream.headers),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Host request failed";
    return Response.json(
      {
        error: "host_unreachable",
        message,
        host: host.origin,
        surface: "vercel-desk",
      },
      { status: 502 },
    );
  }
}
