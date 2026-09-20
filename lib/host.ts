export class HostUnconfiguredError extends Error {
  readonly code = "host_unconfigured" as const;

  constructor() {
    super(
      "WORKERLAYER_HOST_URL is not set. This desk is a control surface only; Workers, startTask, and Manifest exec stay on the Mac mini host.",
    );
    this.name = "HostUnconfiguredError";
  }
}

export class HostUrlInvalidError extends Error {
  readonly code = "host_url_invalid" as const;

  constructor(message: string) {
    super(message);
    this.name = "HostUrlInvalidError";
  }
}

export type EnvMap = Record<string, string | undefined>;

export function getHostUrlString(env: EnvMap = process.env): string | null {
  const raw = env.WORKERLAYER_HOST_URL?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function resolveHostUrl(env: EnvMap = process.env): URL {
  const raw = getHostUrlString(env);
  if (!raw) {
    throw new HostUnconfiguredError();
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HostUrlInvalidError(
      "WORKERLAYER_HOST_URL must be an absolute http(s) URL pointing at the Mac mini host.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HostUrlInvalidError("WORKERLAYER_HOST_URL must use http or https.");
  }

  return url;
}

export function hostBaseHref(host: URL): string {
  const copy = new URL(host);
  if (!copy.pathname.endsWith("/")) {
    copy.pathname += "/";
  }
  return copy.href;
}

/** Host compute routes live under `/api/...`. Desk aliases omit that prefix. */
export function hostApiPath(path: string): string {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) return "api";
  if (clean === "api" || clean.startsWith("api/")) return clean;
  return `api/${clean}`;
}

export function buildHostTarget(host: URL, path: string, search = ""): URL {
  const clean = path.replace(/^\/+/, "");
  const target = new URL(clean, hostBaseHref(host));

  if (target.origin !== host.origin) {
    throw new HostUrlInvalidError("Refusing to proxy off the configured host origin.");
  }

  if (search) {
    target.search = search.startsWith("?") ? search.slice(1) : search;
  }

  return target;
}

export function publicHostLabel(env: EnvMap = process.env): {
  configured: boolean;
  origin: string | null;
} {
  try {
    const host = resolveHostUrl(env);
    return { configured: true, origin: host.origin };
  } catch (error) {
    if (error instanceof HostUnconfiguredError) {
      return { configured: false, origin: null };
    }
    return { configured: false, origin: null };
  }
}
