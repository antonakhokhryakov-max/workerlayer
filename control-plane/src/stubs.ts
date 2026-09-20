/**
 * Stage 2–7 surfaces. Interfaces only — not implemented.
 */

export interface SsoProvider {
  readonly kind: "sso";
  authenticate(): Promise<never>;
}

export interface ByoAgentRegistration {
  readonly kind: "byo-agent";
  /** Later: customer's agent → our control plane → our workstation. */
  registerExternalAgent(): Promise<never>;
}

export function notBuilt(feature: string): never {
  throw new Error(`${feature} is reserved for a later stage and is not built.`);
}
