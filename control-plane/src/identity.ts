import type { Principal, TaskWorkerIdentity } from "@aether/contracts";
import { id, nowIso } from "@aether/contracts";

/** Human operator assigning knowledge work. */
export function userPrincipal(name = "Anton"): Principal {
  return { type: "user", id: "user_operator", name };
}

/**
 * First-party knowledge-work agent.
 * Untrusted for authorization — being ours is not a privilege.
 */
export function agentPrincipal(): Principal {
  return {
    type: "agent",
    id: "aether-knowledge-worker",
    name: "WorkerLayer knowledge worker",
    untrusted: true,
  };
}

export function controlPlanePrincipal(): Principal {
  return {
    type: "control-plane",
    id: "aether-control-plane",
    name: "WorkerLayer control plane",
  };
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Temporary worker identity for one assignment.
 * Assignment → identity → capabilities → execution → expiration.
 */
export function issueTaskIdentity(
  taskId: string,
  granted: string[],
  denied: string[] = [],
  requireApproval: string[] = [],
  ttlMs = DEFAULT_TTL_MS,
): TaskWorkerIdentity {
  const issuedAt = nowIso();
  return {
    id: id("wrk"),
    taskId,
    issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + ttlMs).toISOString(),
    status: "active",
    granted: [...granted],
    denied: [...denied],
    requireApproval: [...requireApproval],
  };
}

export function expireIdentity(identity: TaskWorkerIdentity): TaskWorkerIdentity {
  return {
    ...identity,
    status: "expired",
    expiresAt: nowIso(),
  };
}

export function identityIsUsable(identity: TaskWorkerIdentity, now = Date.now()): boolean {
  if (identity.status !== "active") return false;
  return Date.parse(identity.expiresAt) > now;
}
