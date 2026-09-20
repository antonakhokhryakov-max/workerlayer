import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectStaffScenario } from "@aether/agent";
import { evaluatePolicy } from "@aether/control-plane";
import type { ActionRequest, TaskBrief } from "@aether/contracts";
import { id } from "@aether/contracts";
import {
  AetherPlatform,
  packName,
  persistentWorkerId,
  runStaffInvestorTask,
  runStaffWeeklyTask,
} from "@aether/runtime";
import { tempStore } from "./helpers";
import {
  INVESTOR_GOAL,
  INVESTOR_TOOLS,
  WEEKLY_GOAL,
  WEEKLY_TOOLS,
} from "../fixtures/north-dock-staff/manifest";

function request(tool: string, args: Record<string, unknown> = {}): ActionRequest {
  return { id: id("req"), taskId: "tsk_test", tool, args, requestedBy: "agent" };
}

function brief(goal: string, tools: typeof WEEKLY_TOOLS, name: string): TaskBrief {
  return {
    id: "tsk_test",
    goal,
    createdAt: new Date().toISOString(),
    createdBy: { type: "user", id: "u", name: "Anton" },
    sourceFiles: [{ name, relativePath: `sources/${name}` }],
    registeredTools: tools,
    workerKind: "chief_of_staff",
  };
}

describe("North Dock chief of staff (Instinct-for-X)", () => {
  it("does not treat 'do not draft an investor update' as the investor scenario", () => {
    expect(detectStaffScenario(brief(WEEKLY_GOAL, WEEKLY_TOOLS, "weekly-notes.md"))).toBe("weekly");
    expect(detectStaffScenario(brief(INVESTOR_GOAL, INVESTOR_TOOLS, "investor-notes.md"))).toBe(
      "investor",
    );
  });

  it("two Tasks share one persistent Worker with different manifests", () => {
    const plat = new AetherPlatform(tempStore());
    const worker = plat.ensureWorker("chief_of_staff");
    expect(worker.id).toBe(persistentWorkerId("chief_of_staff"));
    const weekly = plat.createTask(worker.id, {
      goal: "Prep weekly leadership sync",
      fileContents: [{ name: "weekly-notes.md", bytes: "P: Hire." }],
      registeredTools: WEEKLY_TOOLS,
    });
    const investor = plat.createTask(worker.id, {
      goal: "Draft investor update",
      fileContents: [{ name: "investor-notes.md", bytes: "ARR: 1." }],
      registeredTools: INVESTOR_TOOLS,
    });
    expect(weekly.brief.workerId).toBe(worker.id);
    expect(investor.brief.workerId).toBe(worker.id);
    expect(weekly.brief.capabilityManifestId).not.toBe(investor.brief.capabilityManifestId);
    const weeklyManifest = plat.getManifest(weekly.brief.capabilityManifestId!);
    const investorManifest = plat.getManifest(investor.brief.capabilityManifestId!);
    expect(weeklyManifest?.granted).toContain("staff:meeting_prep");
    expect(weeklyManifest?.granted).not.toContain("staff:investor_update");
    expect(investorManifest?.granted).toContain("staff:investor_update");
    expect(investorManifest?.granted).not.toContain("staff:meeting_prep");
  });

  it("denies the other scenario's tool before a run", () => {
    const plat = new AetherPlatform(tempStore());
    const worker = plat.ensureWorker("chief_of_staff");
    const weekly = plat.createTask(worker.id, {
      goal: "Prep weekly leadership sync",
      fileContents: [{ name: "weekly-notes.md", bytes: "P: Hire." }],
      registeredTools: WEEKLY_TOOLS,
    });
    const caps = {
      workspaceRoot: "/tmp",
      allowedReadPrefixes: ["sources/", "originals/"],
      allowedWritePrefixes: ["artifacts/", "findings.json"],
      networkAllowlist: [],
      sensitiveDestinations: [],
      canExport: false,
      maxSteps: 16,
      granted: plat.getManifest(weekly.brief.capabilityManifestId!)!.granted,
      denied: plat.getManifest(weekly.brief.capabilityManifestId!)!.denied,
      requireApproval: plat.getManifest(weekly.brief.capabilityManifestId!)!.requireApproval,
      registeredTools: WEEKLY_TOOLS,
    };
    expect(evaluatePolicy(request("staff.priorities", { path: "p.md", text: "x" }), caps).decision).toBe(
      "allow",
    );
    expect(
      evaluatePolicy(request("staff.investor_update", { path: "i.md", text: "x" }), caps).decision,
    ).toBe("deny");
    expect(evaluatePolicy(request("staff.payroll"), caps).decision).toBe("deny");
  });

  it("runs weekly leadership prep through AetherPlatform with real denials and teardown", async () => {
    const store = tempStore();
    const { task } = await runStaffWeeklyTask(store);
    expect(task.brief.workerKind).toBe("chief_of_staff");
    expect(task.brief.workerId).toBe("wkr_chief_of_staff");
    expect(packName(task)).toBe("staff");
    expect(task.company).toBe("North Dock");
    expect(task.status).toBe("awaiting_review");
    expect(task.plan?.summary).toMatch(/leadership sync/i);
    expect(task.environment?.status).toBe("destroyed");
    expect(task.isolation?.status).toBe("destroyed");
    expect(task.environment?.substrates).toEqual(["DIRECT_TOOL"]);

    const root = store.workspaceRoot(task.brief.id);
    expect(existsSync(join(root, "artifacts/weekly-priorities.md"))).toBe(true);
    expect(existsSync(join(root, "artifacts/meeting-prep.md"))).toBe(true);
    expect(existsSync(join(root, "artifacts/open-questions.md"))).toBe(true);
    expect(readFileSync(join(root, "artifacts/weekly-priorities.md"), "utf8")).toMatch(/Oakland/);
    expect(existsSync(join(root, "artifacts/investor-update.md"))).toBe(false);

    const audit = store.readAudit(task.brief.id);
    const decide = (tool: string) =>
      audit.filter((event) => event.tool === tool && event.action === "policy.decide");
    expect(decide("staff.priorities").some((event) => event.decision === "allow")).toBe(true);
    expect(decide("staff.meeting_prep").some((event) => event.decision === "allow")).toBe(true);
    expect(decide("staff.investor_update").some((event) => event.decision === "deny")).toBe(true);
    expect(decide("workspace.read_file").some((event) => event.decision === "deny")).toBe(true);
    expect(audit.some((event) => event.action === "environment.destroyed")).toBe(true);
    expect(readFileSync(store.auditPath(task.brief.id), "utf8")).toMatch(/"decision":"deny"/);
  }, 60_000);

  it("runs investor update on the same Worker with a different CapabilityManifest", async () => {
    const store = tempStore();
    const plat = new AetherPlatform(store);
    const weekly = await runStaffWeeklyTask(store);
    const investor = await runStaffInvestorTask(store);

    expect(weekly.task.brief.workerId).toBe("wkr_chief_of_staff");
    expect(investor.task.brief.workerId).toBe("wkr_chief_of_staff");
    expect(plat.getWorker("wkr_chief_of_staff")?.taskIds).toEqual(
      expect.arrayContaining([weekly.task.brief.id, investor.task.brief.id]),
    );
    expect(weekly.task.brief.capabilityManifestId).not.toBe(investor.task.brief.capabilityManifestId);
    expect(investor.task.status).toBe("awaiting_review");
    expect(investor.task.plan?.summary).toMatch(/investor update/i);
    expect(investor.task.environment?.status).toBe("destroyed");

    const root = store.workspaceRoot(investor.task.brief.id);
    expect(existsSync(join(root, "artifacts/investor-update.md"))).toBe(true);
    expect(existsSync(join(root, "artifacts/decision-log.md"))).toBe(true);
    expect(readFileSync(join(root, "artifacts/investor-update.md"), "utf8")).toMatch(/\$1\.2 million/);
    expect(existsSync(join(root, "artifacts/meeting-prep.md"))).toBe(false);

    const audit = store.readAudit(investor.task.brief.id);
    expect(
      audit.some(
        (event) =>
          event.tool === "staff.meeting_prep" &&
          event.action === "policy.decide" &&
          event.decision === "deny",
      ),
    ).toBe(true);
    expect(
      audit.some(
        (event) =>
          event.tool === "staff.payroll" && event.action === "policy.decide" && event.decision === "deny",
      ),
    ).toBe(true);
  }, 60_000);
});
