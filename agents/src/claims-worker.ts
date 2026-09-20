import type { ActionRequest, AgentIntent, HandledAction, TaskBrief, WorkPlan } from "@aether/contracts";
import { id } from "@aether/contracts";
import type { Finding } from "@aether/contracts";

/**
 * Synthetic embedded agent from Cedarline Mutual, a legacy claims vendor.
 * It only requests claims tools. It does not authorize and it is not the
 * first-party knowledge worker.
 */
export class ClaimsWorker {
  planState?: WorkPlan;
  findings: Finding[] = [];
  company = "Cedarline Mutual";
  summary?: string;
  read = false;
  updated = false;
  deniedUnrelated = false;
  payRequested = false;
  focusId = "CLM-1044";
  payAmount = 4200;

  plan(task: TaskBrief): WorkPlan {
    this.planState = {
      summary: `Cedarline Claims Agent on ${task.goal}`,
      steps: [
        { id: "read", title: "Read the claims ledger", detail: "Request claims.read.", status: "pending" },
        { id: "update", title: "Update the open claim", detail: "Request claims.update.", status: "pending" },
        { id: "unrelated", title: "Try unrelated data", detail: "Request unrelated.data so the deny is visible.", status: "pending" },
        { id: "pay", title: "Request payment", detail: "Request claims.pay. The control plane must hold this.", status: "pending" },
      ],
    };
    return this.planState;
  }

  observe(handled: HandledAction): void {
    const data = handled.result.data ?? {};
    if (handled.request.tool === "claims.read" && handled.result.ok) {
      this.read = true;
      this.mark("read", "done");
      const claims = Array.isArray(data.claims) ? data.claims : [];
      this.findings = claims.map((claim) => {
        const row = claim as { id?: string; status?: string; reserve?: number; policyholder?: string };
        return {
          category: "Claim",
          finding: `${row.id ?? "claim"} ${row.status ?? "open"} reserve ${row.reserve ?? "?"}`,
          evidence: String(row.policyholder ?? "ledger"),
          source: "ledger.json",
          confidence: "high" as const,
        };
      });
    }
    if (handled.request.tool === "claims.update" && handled.result.ok) {
      this.updated = true;
      this.mark("update", "done");
      const claim = data.claim as { id?: string; status?: string } | undefined;
      this.findings.push({
        category: "Claim",
        finding: `${claim?.id ?? this.focusId} updated to ${claim?.status ?? "reviewed"}`,
        evidence: "claims.update",
        source: "ledger.json",
        confidence: "high",
      });
    }
    if (handled.request.tool === "unrelated.data") {
      this.deniedUnrelated = true;
      this.mark("unrelated", "done");
    }
    if (handled.request.tool === "claims.pay") {
      this.payRequested = true;
      this.mark("pay", handled.result.status === "pending_approval" ? "blocked" : "done");
    }
  }

  async nextIntent(task: TaskBrief): Promise<AgentIntent> {
    const request = (
      tool: ActionRequest["tool"],
      args: Record<string, unknown>,
      rationale: string,
    ): ActionRequest => ({
      id: id("req"),
      taskId: task.id,
      tool,
      args,
      requestedBy: "agent",
      rationale,
    });

    if (!this.read) {
      return {
        type: "request",
        request: request("claims.read", {}, "Load the Cedarline claims ledger for this assignment."),
      };
    }
    if (!this.updated) {
      return {
        type: "request",
        request: request(
          "claims.update",
          {
            claimId: this.focusId,
            status: "reviewed",
            note: "Reviewed by the Cedarline claims agent. Payment still needs approval.",
          },
          "Mark CLM-1044 reviewed after reading the ledger.",
        ),
      };
    }
    if (!this.deniedUnrelated) {
      return {
        type: "request",
        request: request(
          "unrelated.data",
          { system: "policy-admin", table: "underwriting" },
          "Pull underwriting tables from an unrelated system.",
        ),
      };
    }
    if (!this.payRequested) {
      return {
        type: "request",
        request: request(
          "claims.pay",
          { claimId: this.focusId, amount: this.payAmount },
          "Pay the reviewed reserve. The agent cannot authorize this itself.",
        ),
      };
    }
    return {
      type: "finish",
      summary: "Cedarline Claims Agent requested read, update, an unrelated pull, and payment.",
    };
  }

  private mark(id: string, status: WorkPlan["steps"][number]["status"]): void {
    if (!this.planState) return;
    this.planState = {
      ...this.planState,
      steps: this.planState.steps.map((step) => (step.id === id ? { ...step, status } : step)),
    };
  }
}
