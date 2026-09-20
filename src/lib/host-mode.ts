/**
 * Fork Split: the Next process on Vercel is the desk control surface only.
 * WorkerEnvironment / startTask / Manifest exec stay on the always-on HOST
 * (Ant’s Mac mini). Never set WORKERLAYER_HOST_URL on that host.
 *
 * Origin is git source of truth. GitHub is a Vercel-import mirror, not SoT.
 */

export const HOST_URL_ENV = "WORKERLAYER_HOST_URL";

export class ControlSurfaceError extends Error {
  readonly status = 503;
  readonly code = "control_surface_only";

  constructor(action: string) {
    super(
      `Control surface only: ${action} runs on the Mac mini host (${HOST_URL_ENV}), never on Vercel and never in the browser.`,
    );
    this.name = "ControlSurfaceError";
  }
}

export function hostUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env[HOST_URL_ENV]?.trim();
  return raw ? raw.replace(/\/$/, "") : undefined;
}

export function isVercelRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === "1";
}

/** Desk UI / proxy process. Compute is forbidden here. */
export function isControlSurface(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(hostUrl(env)) || isVercelRuntime(env);
}

export function assertHostCompute(
  action: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (isControlSurface(env)) {
    throw new ControlSurfaceError(action);
  }
}

export const MISSING_HOST_BODY = {
  error:
    "Vercel is the desk control surface only. Set WORKERLAYER_HOST_URL to the Mac mini `pnpm start` URL. Workers never run on Vercel.",
  code: "missing_host_url",
} as const;
