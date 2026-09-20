import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  claimsWorkerCapabilities,
  defaultKnowledgeWorkCapabilities,
  evaluatePolicy,
} from "@aether/control-plane";
import type { ActionRequest } from "@aether/contracts";
import { id } from "@aether/contracts";
import {
  packName,
  resolveTaskApproval,
  reviewTask,
  runCedarlineClaimsTask,
  runSampleTask,
} from "@aether/runtime";
import { tempStore } from "./helpers";

function request(tool: ActionRequest["tool"], args: Record<string, unknown> = {}): ActionRequest {
  return { id: id("req"), taskId: "tsk_test", tool, args, requestedBy: "agent" };
}

describe("Cedarline Claims Agent", () => {
  it("registers allow / require approval / deny on the same policy as Harbor", () => {
    const claims = claimsWorkerCapabilities("/tmp/ws");
    expect(claims.granted).toEqual(
      expect.arrayContaining(["claims:read", "claims:update", "claims:pay"]),
    );
    expect(claims.denied).toContain("unrelated:data");
    expect(claims.granted).not.toContain("spreadsheet:create");
    expect(claims.granted).not.toContain("code:execute:sandbox");
    expect(evaluatePolicy(request("claims.read"), claims).decision).toBe("allow");
    expect(evaluatePolicy(request("claims.update", { claimId: "CLM-1044" }), claims).decision).toBe(
      "allow",
    );
    expect(evaluatePolicy(request("claims.pay", { claimId: "CLM-1044", amount: 4200 }), claims).decision)
      .toBe("require_approval");
    expect(evaluatePolicy(request("unrelated.data"), claims).decision).toBe("deny");

    const knowledge = defaultKnowledgeWorkCapabilities("/tmp/ws");
    expect(evaluatePolicy(request("claims.read"), knowledge).decision).toBe("deny");
    expect(evaluatePolicy(request("claims.pay", { claimId: "CLM-1044", amount: 1 }), knowledge).decision)
      .toBe("deny");
  });

  it("runs the second worker through the same environment and records all four decisions", async () => {
    const store = tempStore();
    const { task } = await runCedarlineClaimsTask(store);

    expect(task.brief.workerKind).toBe("claims");
    expect(packName(task)).toBe("claims");
    expect(task.company).toMatch(/Cedarline Mutual/i);
    expect(task.modelProvider).toBe("cedarline-claims");
    expect(task.status).toBe("blocked_on_approval");
    expect(task.identity?.status).toBe("active");
    expect(task.identity?.granted).toContain("claims:read");
    expect(task.identity?.granted).not.toContain("spreadsheet:create");
    expect(task.identity?.granted).not.toContain("code:execute:sandbox");
    expect(task.environment?.substrates).toEqual(["DIRECT_TOOL"]);
    expect(task.environment?.status).toBe("destroyed");
    expect(task.isolation?.status).toBe("destroyed");
    expect(task.quality).toBeUndefined();

    const audit = store.readAudit(task.brief.id);
    const decide = (tool: string) =>
      audit.filter((event) => event.tool === tool && event.action === "policy.decide");
    expect(decide("claims.read").some((event) => event.decision === "allow")).toBe(true);
    expect(decide("claims.update").some((event) => event.decision === "allow")).toBe(true);
    expect(decide("unrelated.data").some((event) => event.decision === "deny")).toBe(true);
    expect(decide("claims.pay").some((event) => event.decision === "require_approval")).toBe(true);
    expect(audit.some((event) => event.action === "environment.destroyed")).toBe(true);

    const ledgerPath = join(store.workspaceRoot(task.brief.id), "artifacts/claims/ledger.json");
    expect(existsSync(ledgerPath)).toBe(true);
    const before = JSON.parse(readFileSync(ledgerPath, "utf8")) as {
      claims: Array<{ id: string; status: string; paidAmount?: number }>;
    };
    expect(before.claims.find((claim) => claim.id === "CLM-1044")?.status).toBe("reviewed");
    expect(before.claims.find((claim) => claim.id === "CLM-1044")?.paidAmount).toBeUndefined();

    const pending = store.loadApprovals(task.brief.id).find((ticket) => ticket.status === "pending");
    expect(pending?.request.tool).toBe("claims.pay");
    const afterPay = await resolveTaskApproval(store, task.brief.id, pending!.id, "approved");
    expect(afterPay.status).toBe("awaiting_review");
    expect(afterPay.summary).toMatch(/CLM-1044 paid 4200/i);
    expect(afterPay.identity?.status).toBe("active");
    expect(afterPay.environment?.status).toBe("destroyed");
    const paid = JSON.parse(readFileSync(ledgerPath, "utf8")) as {
      claims: Array<{ id: string; status: string; paidAmount?: number }>;
    };
    expect(paid.claims.find((claim) => claim.id === "CLM-1044")?.status).toBe("paid");
    expect(paid.claims.find((claim) => claim.id === "CLM-1044")?.paidAmount).toBe(4200);

    const accepted = await reviewTask(store, task.brief.id, "accept");
    expect(accepted.status).toBe("accepted");
    expect(accepted.identity?.status).toBe("expired");
    expect(accepted.review?.fixRequests).toBe(0);
    expect(existsSync(ledgerPath)).toBe(true);
  }, 60_000);

  it("does not change Harbor's WorkerEnvironment or substrates", async () => {
    const store = tempStore();
    const { task } = await runSampleTask(store);
    expect(task.brief.workerKind ?? "knowledge").not.toBe("claims");
    expect(packName(task)).toBe("harbor");
    expect(task.quality?.deliveryScore).toBe(1);
    expect(task.environment?.substrates).toEqual(expect.arrayContaining(["DIRECT_TOOL", "SANDBOX"]));
    expect(task.identity?.granted).toContain("spreadsheet:create");
    expect(task.identity?.granted).toContain("code:execute:sandbox");
    expect(task.identity?.granted).not.toContain("claims:pay");
    expect(
      store.readAudit(task.brief.id).some((event) => event.tool === "claims.pay"),
    ).toBe(false);
  }, 60_000);
});
