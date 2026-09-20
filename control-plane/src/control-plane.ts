import type {
  ActionRequest,
  ActionResult,
  ApprovalTicket,
  ExecutionGrant,
  GrantVerifier,
  HandledAction,
  TaskBrief,
  TaskCapabilities,
  TaskWorkerIdentity,
} from "@aether/contracts";
import { ApprovalDesk } from "./approvals";
import { AuditLog } from "./audit";
import { GrantRegistry } from "./grants";
import { expireIdentity, identityIsUsable, issueTaskIdentity } from "./identity";
import { evaluatePolicy } from "./policy";

export interface WorkstationPort {
  execute(request: ActionRequest, grant: ExecutionGrant): Promise<ActionResult>;
}

export class ControlPlane {
  readonly grants: GrantRegistry;
  readonly approvals: ApprovalDesk;
  identity: TaskWorkerIdentity;

  constructor(
    readonly audit: AuditLog,
    readonly capabilities: TaskCapabilities,
    readonly task: TaskBrief,
    grants?: GrantRegistry,
    approvals?: ApprovalDesk,
    identity?: TaskWorkerIdentity,
  ) {
    this.grants = grants ?? new GrantRegistry();
    this.approvals = approvals ?? new ApprovalDesk();
    this.identity =
      identity ??
      issueTaskIdentity(
        task.id,
        capabilities.granted,
        capabilities.denied ?? [],
        capabilities.requireApproval ?? [],
      );
  }

  expireIdentity(): TaskWorkerIdentity {
    if (this.identity.status !== "expired") {
      this.identity = expireIdentity(this.identity);
      this.audit.record({
        taskId: this.task.id,
        actor: "control-plane",
        action: "identity.expired",
        details: {
          identityId: this.identity.id,
          expiresAt: this.identity.expiresAt,
        },
      });
    }
    return this.identity;
  }

  reissueIdentity(): TaskWorkerIdentity {
    this.identity = issueTaskIdentity(
      this.task.id,
      this.capabilities.granted,
      this.capabilities.denied ?? [],
      this.capabilities.requireApproval ?? [],
    );
    this.audit.record({
      taskId: this.task.id,
      actor: "control-plane",
      action: "identity.reissued",
      details: {
        identityId: this.identity.id,
        granted: this.identity.granted,
        expiresAt: this.identity.expiresAt,
      },
    });
    return this.identity;
  }

  grantVerifier(): GrantVerifier {
    return this.grants;
  }

  /**
   * Trusted entry: evaluate → grant or hold → optional execution → audit.
   * Agent intent is never authorization.
   */
  async dispatch(
    request: ActionRequest,
    workstation: WorkstationPort,
  ): Promise<HandledAction> {
    if (!identityIsUsable(this.identity)) {
      this.identity = expireIdentity(this.identity);
      const decision = {
        requestId: request.id,
        decision: "deny" as const,
        reason: "Task worker identity has expired. Credentials for this assignment are no longer valid.",
        policyId: "aether.identity",
      };
      this.audit.record({
        taskId: this.task.id,
        actor: "control-plane",
        action: "policy.decide",
        decision: "deny",
        tool: request.tool,
        details: {
          reason: decision.reason,
          requestId: request.id,
          identityId: this.identity.id,
        },
      });
      return {
        request,
        decision,
        result: { ok: false, status: "denied", error: decision.reason },
      };
    }

    if (request.taskId !== this.task.id || request.taskId !== this.identity.taskId) {
      const decision = {
        requestId: request.id,
        decision: "deny" as const,
        reason: "Request task does not match the open worker identity.",
        policyId: "aether.session",
      };
      this.audit.record({
        taskId: this.task.id,
        actor: "control-plane",
        action: "policy.decide",
        decision: "deny",
        tool: request.tool,
        details: { reason: decision.reason, requestId: request.id, identityId: this.identity.id },
      });
      return {
        request,
        decision,
        result: { ok: false, status: "denied", error: decision.reason },
      };
    }

    const decision = evaluatePolicy(request, this.capabilities);
    this.audit.record({
      taskId: this.task.id,
      actor: "control-plane",
      action: "policy.decide",
      decision: decision.decision,
      tool: request.tool,
      details: {
        reason: decision.reason,
        requestId: request.id,
        args: request.args,
        rationale: request.rationale,
        identityId: this.identity.id,
        crossTask: /cross-task/i.test(decision.reason),
      },
    });

    if (decision.decision === "deny") {
      return {
        request,
        decision,
        result: { ok: false, status: "denied", error: decision.reason },
      };
    }

    if (decision.decision === "require_approval") {
      const ticket = this.approvals.create(request, decision.reason);
      this.audit.record({
        taskId: this.task.id,
        actor: "control-plane",
        action: "approval.required",
        decision: "require_approval",
        tool: request.tool,
        details: { approvalId: ticket.id, reason: decision.reason },
      });
      return {
        request,
        decision,
        result: {
          ok: false,
          status: "pending_approval",
          error: decision.reason,
          approvalId: ticket.id,
        },
      };
    }

    const grant = this.grants.issue(request);
    this.audit.record({
      taskId: this.task.id,
      actor: "control-plane",
      action: "grant.issue",
      decision: "allow",
      tool: request.tool,
      details: { grantId: grant.grantId, requestId: request.id },
    });

    const result = await workstation.execute(request, grant);
    this.audit.record({
      taskId: this.task.id,
      actor: "workstation",
      action: "workstation.execute",
      tool: request.tool,
      details: {
        ok: result.ok,
        status: result.status,
        grantId: grant.grantId,
      },
    });
    return { request, decision, result, grant };
  }

  async resolveApproval(
    ticketId: string,
    status: "approved" | "denied",
    resolvedBy: string,
    workstation: WorkstationPort,
  ): Promise<{ ticket: ApprovalTicket; handled?: HandledAction }> {
    const ticket = this.approvals.resolve(ticketId, status, resolvedBy);
    this.audit.record({
      taskId: this.task.id,
      actor: "user",
      action: status === "approved" ? "approval.granted" : "approval.denied",
      decision: status === "approved" ? "allow" : "deny",
      tool: ticket.request.tool,
      details: { approvalId: ticket.id, resolvedBy },
    });

    if (status === "denied") {
      return { ticket };
    }

    const grant = this.grants.issue(ticket.request);
    const result = await workstation.execute(ticket.request, grant);
    this.audit.record({
      taskId: this.task.id,
      actor: "workstation",
      action: "workstation.execute",
      tool: ticket.request.tool,
      details: {
        ok: result.ok,
        status: result.status,
        grantId: grant.grantId,
        via: "approval",
      },
    });
    return {
      ticket,
      handled: {
        request: ticket.request,
        decision: {
          requestId: ticket.request.id,
          decision: "allow",
          reason: "Operator approved the sensitive action.",
          policyId: "aether.approval",
        },
        result,
        grant,
      },
    };
  }
}
