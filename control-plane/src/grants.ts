import { createHash } from "node:crypto";
import type {
  ActionRequest,
  ExecutionGrant,
  GrantVerifier,
} from "@aether/contracts";
import { id, nowIso } from "@aether/contracts";

export function digestArgs(args: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(args)).digest("hex");
}

/**
 * One-time execution grants. The workstation refuses work without a grant
 * issued by the control plane for that exact request.
 */
export class GrantRegistry implements GrantVerifier {
  private readonly issued = new Map<string, ExecutionGrant>();
  private readonly consumed = new Set<string>();

  issue(request: ActionRequest): ExecutionGrant {
    const grant: ExecutionGrant = {
      grantId: id("grt"),
      requestId: request.id,
      taskId: request.taskId,
      tool: request.tool,
      argsDigest: digestArgs(request.args),
      issuedAt: nowIso(),
    };
    this.issued.set(grant.grantId, grant);
    return grant;
  }

  verify(grant: ExecutionGrant, request: ActionRequest): boolean {
    const known = this.issued.get(grant.grantId);
    if (!known) return false;
    if (this.consumed.has(grant.grantId)) return false;
    if (known.requestId !== request.id) return false;
    if (known.taskId !== request.taskId) return false;
    if (known.tool !== request.tool) return false;
    if (known.argsDigest !== digestArgs(request.args)) return false;
    return true;
  }

  consume(grantId: string): void {
    this.consumed.add(grantId);
  }
}
