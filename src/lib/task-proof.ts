import type { AuditEvent } from "@aether/contracts";
import type { StoredTask } from "@aether/runtime";

export interface TaskProof {
  allowTools: string[];
  denyTools: string[];
  approvalTools: string[];
  tornDown: boolean;
  identityExpired: boolean;
}

export function taskProof(task: StoredTask, audit: AuditEvent[]): TaskProof {
  const named = (decision: "allow" | "deny" | "require_approval") => [
    ...new Set(
      audit
        .filter((event) => event.decision === decision && event.tool)
        .map((event) => String(event.tool)),
    ),
  ];
  return {
    allowTools: named("allow"),
    denyTools: named("deny"),
    approvalTools: named("require_approval"),
    tornDown:
      task.environment?.status === "destroyed" || task.isolation?.status === "destroyed",
    identityExpired: task.identity?.status === "expired",
  };
}

export function taskProofLine(proof: TaskProof): string {
  const deny =
    proof.denyTools.length > 0 ? `DENY ${proof.denyTools.join(", ")}` : "no DENY yet";
  const env = proof.tornDown ? "torn down" : "environment still up";
  return `${deny} · ${env}`;
}

/** Activity-log mark. ALLOW / DENY / REQUIRE_APPROVAL — not a security console. */
export function trailMark(event: AuditEvent): string {
  if (event.decision === "allow") return "ALLOW";
  if (event.decision === "deny") return "DENY";
  if (event.decision === "require_approval") return "REQUIRE_APPROVAL";
  if (event.action === "environment.destroyed") return "torn down";
  if (event.action === "manifest.grant") return "Grant selected";
  return "";
}

export function trailReason(event: AuditEvent): string {
  if (event.action === "manifest.grant") {
    const grantor =
      typeof event.details.grantor === "string" && event.details.grantor.length > 0
        ? event.details.grantor
        : "human";
    const caps = Array.isArray(event.details.capabilitiesAdded)
      ? event.details.capabilitiesAdded.map(String).filter(Boolean).join(", ")
      : "";
    return `${grantor}${caps ? ` · ${caps}` : ""} · Task-scoped. Not a standing ALLOW.`;
  }
  if (typeof event.details.reason === "string" && event.details.reason.length > 0) {
    return event.details.reason;
  }
  if (event.action === "environment.destroyed") return "torn down";
  return "";
}
