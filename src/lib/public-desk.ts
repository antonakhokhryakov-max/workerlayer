/**
 * Where a founder opens the WorkerLayer desk in a browser.
 *
 * This is a temporary Cloudflare quick tunnel to the Alpha host on this
 * build machine. It is not a Vercel preview and not a lasting site.
 * Origin stays git source of truth. GitHub is a Vercel-import mirror only
 * (not product SoT) and is not connected yet. Vercel is not connected —
 * the control-surface split is in the repo (WORKERLAYER_HOST_URL) but we
 * do not invent a Vercel URL.
 */
export const PUBLIC_DESK_URL =
  "https://lauderdale-mar-seemed-circle.trycloudflare.com";

export const PUBLIC_DESK_KIND = "temporary-cloudflare-quick-tunnel" as const;

export const PUBLIC_DESK_NOTE =
  "Temporary Cloudflare tunnel for Alpha access — not a lasting Vercel or production site. Open this URL from a laptop. This website is the control surface; WorkerEnvironment and sticky compute run on the host, not in the browser. If the link dies, Founding Engineer restarts the tunnel on the build host and posts a new hostname (quick tunnels mint a new URL each start).";
