import type { AuditEvent, GovernanceMetrics, TaskWorkerIdentity } from "@aether/contracts";
import { TOOL_CAPABILITY } from "./capabilities";

export function summarizeGovernance(
  events: AuditEvent[],
  identity?: TaskWorkerIdentity,
): GovernanceMetrics {
  const decisions = events.filter((event) => event.action === "policy.decide");
  const authorizedActions = decisions.filter((event) => event.decision === "allow").length;
  const deniedActions = decisions.filter((event) => event.decision === "deny").length;
  const approvalRequests = events.filter(
    (event) => event.action === "approval.required" || event.decision === "require_approval",
  ).length;

  const capabilitiesRequested = [
    ...new Set(
      events
        .filter((event) => event.action === "action.requested" && event.tool)
        .map((event) => TOOL_CAPABILITY[event.tool!] ?? String(event.tool)),
    ),
  ];

  const crossTaskAccessAttempts = decisions.filter((event) => {
    if (event.decision !== "deny") return false;
    if (event.details.crossTask === true) return true;
    const reason = String(event.details.reason ?? "").toLowerCase();
    return reason.includes("cross-task") || reason.includes("other task");
  }).length;

  return {
    authorizedActions,
    deniedActions,
    approvalRequests,
    capabilitiesGranted: identity?.granted.length ?? 0,
    capabilitiesRequested,
    policyFailures: deniedActions,
    crossTaskAccessAttempts,
  };
}
