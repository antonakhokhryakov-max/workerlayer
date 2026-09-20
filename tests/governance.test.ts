import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "@aether/agent";
import {
  AuditLog,
  ControlPlane,
  defaultKnowledgeWorkCapabilities,
  evaluatePolicy,
  issueTaskIdentity,
} from "@aether/control-plane";
import type { ActionRequest } from "@aether/contracts";
import { id } from "@aether/contracts";
import { newBrief, runKnowledgeTask } from "@aether/runtime";
import { TaskWorkspace, Workstation } from "@aether/workstation";
import { tempStore, writeResearchPack } from "./helpers";

function request(
  tool: ActionRequest["tool"],
  args: Record<string, unknown>,
  taskId = "tsk_test",
): ActionRequest {
  return { id: id("req"), taskId, tool, args, requestedBy: "agent" };
}

describe("task-scoped access and a real deny in one run", () => {
  it("completes useful work and records agent-requested denials", async () => {
    const store = tempStore();
    const brief = newBrief(
      "Research this company using the attached materials. Produce a spreadsheet and presentation. Cite sources and flag uncertainty.",
      [
        { name: "company-brief.md", relativePath: "sources/company-brief.md" },
        { name: "notes.txt", relativePath: "sources/notes.txt" },
        { name: "memo.pdf", relativePath: "sources/memo.pdf" },
      ],
    );
    await writeResearchPack(store.workspaceRoot(brief.id));
    const { task } = await runKnowledgeTask(brief, {
      store,
      model: new DeterministicProvider(),
    });

    expect(task.status).toBe("awaiting_review");
    expect(task.artifacts.some((item) => item.kind === "spreadsheet" && item.validated)).toBe(true);
    expect(task.artifacts.some((item) => item.kind === "presentation" && item.validated)).toBe(true);
    expect(task.identity?.id).toMatch(/^wrk_/);
    expect(task.identity?.taskId).toBe(brief.id);
    expect(task.identity?.status).toBe("active");
    expect(task.identity?.granted).toContain("files:read:task");
    expect(task.identity?.denied).toContain("network:fetch");

    const audit = store.readAudit(brief.id);
    const requested = audit.filter((event) => event.action === "action.requested");
    expect(requested.some((event) => event.tool === "network.fetch")).toBe(true);
    expect(
      requested.some(
        (event) =>
          event.tool === "workspace.read_file" &&
          String(event.details.args && (event.details.args as { path?: string }).path).includes("tsk_payroll"),
      ),
    ).toBe(true);

    const denials = audit.filter((event) => event.action === "policy.decide" && event.decision === "deny");
    expect(denials.length).toBeGreaterThanOrEqual(2);
    expect(denials.some((event) => event.tool === "network.fetch")).toBe(true);
    expect(denials.some((event) => /cross-task/i.test(String(event.details.reason)))).toBe(true);

    expect(task.governance?.authorizedActions).toBeGreaterThan(5);
    expect(task.governance?.deniedActions).toBeGreaterThanOrEqual(2);
    expect(task.governance?.crossTaskAccessAttempts).toBeGreaterThanOrEqual(1);
    expect(task.governance?.capabilitiesRequested).toContain("network:fetch");
    expect(task.plan?.steps.find((step) => step.id === "scope")?.status).toBe("done");
  });

  it("denies one task reading another task's files", () => {
    const capabilities = defaultKnowledgeWorkCapabilities("/tmp/ws");
    const decision = evaluatePolicy(
      request("workspace.read_file", { path: "tsk_other/sources/notes.md" }, "tsk_alpha"),
      capabilities,
    );
    expect(decision.decision).toBe("deny");
    expect(decision.reason).toMatch(/cross-task/i);
  });

  it("denies work after the task identity expires", async () => {
    const store = tempStore();
    const brief = { ...newBrief("Expired identity", []), id: "tsk_test" };
    const capabilities = defaultKnowledgeWorkCapabilities(store.workspaceRoot(brief.id));
    const identity = issueTaskIdentity(brief.id, capabilities.granted, capabilities.denied, capabilities.requireApproval);
    identity.status = "expired";
    const plane = new ControlPlane(
      new AuditLog(store.auditPath(brief.id)),
      capabilities,
      brief,
      undefined,
      undefined,
      identity,
    );
    const workstation = new Workstation(
      new TaskWorkspace(store.workspaceRoot(brief.id)),
      plane.grantVerifier(),
    );
    const handled = await plane.dispatch(request("workspace.list_files", {}), workstation);
    expect(handled.decision.decision).toBe("deny");
    expect(handled.decision.reason).toMatch(/expired/i);
  });
});
