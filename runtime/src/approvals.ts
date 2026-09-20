import { summarizeGovernance } from "@aether/control-plane";
import { nowIso } from "@aether/contracts";
import { emptyReview, type StoredTask, type TaskStore } from "./store";
import { reopenControlPlane } from "./kernel";

export async function resolveTaskApproval(
  store: TaskStore,
  taskId: string,
  approvalId: string,
  decision: "approved" | "denied",
): Promise<StoredTask> {
  const task = store.get(taskId);
  if (!task) throw new Error(`Unknown task ${taskId}`);
  const originalIsolation = task.isolation;
  const originalEnv = task.environment;
  const { plane, workstation, environment } = reopenControlPlane(task, store);
  try {
    const { ticket, handled } = await plane.resolveApproval(
      approvalId,
      decision,
      "operator",
      workstation,
    );
    environment.syncOut();
    store.saveApprovals(taskId, plane.approvals.list(taskId));
    if (ticket.request.tool === "claims.pay") {
      task.status = "awaiting_review";
      task.review = task.review ?? emptyReview();
      task.review.status = "pending";
      if (decision === "approved" && handled?.result.ok) {
        task.summary = String(handled.result.data?.message ?? "Claim paid after operator approval.");
        task.findings = [
          ...task.findings,
          {
            category: "Payment",
            finding: String(handled.result.data?.message ?? "Payment recorded."),
            evidence: "claims.pay",
            source: "ledger.json",
            confidence: "high",
          },
        ];
      } else {
        task.summary = "Claim payment was denied by the operator.";
      }
    }
    task.identity = plane.identity;
    task.governance = summarizeGovernance(plane.audit.list(), plane.identity);
    store.save(task);
    return store.get(taskId) ?? task;
  } finally {
    environment.destroy();
    const latest = store.get(taskId) ?? task;
    latest.isolation = originalIsolation
      ? { ...originalIsolation, status: "destroyed" }
      : environment.record();
    if (originalEnv) {
      latest.environment = { ...originalEnv, status: "destroyed", destroyedAt: nowIso() };
    }
    store.save(latest);
  }
}
