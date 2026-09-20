/** Stage 2 Alpha: grant already selected, identity-only key, no SSO, no compute picker. */
export const STAGE = {
  id: 2,
  name: "Stage 2",
  grantMode: "selected",
  keyKind: "identity-only",
  sso: false,
  computePicker: false,
} as const;

export const DEFAULT_GRANT_ID = "alpha-stage-2";

export type EnvMap = Record<string, string | undefined>;

export function getGrantId(env: EnvMap = process.env): string {
  const raw = env.WORKERLAYER_GRANT_ID?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_GRANT_ID;
}

export function getIdentityKey(env: EnvMap = process.env): string | null {
  const raw = env.WORKERLAYER_IDENTITY_KEY?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function maskIdentityKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}
