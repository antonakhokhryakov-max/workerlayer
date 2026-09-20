import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "@aether/agent";
import { defaultKnowledgeWorkCapabilities, evaluatePolicy } from "@aether/control-plane";
import type { ActionRequest } from "@aether/contracts";
import { id } from "@aether/contracts";
import { packName, newBrief, runBenchmarkTask, runKnowledgeTask } from "@aether/runtime";
import { TaskWorkspace } from "@aether/workstation";
import { tempStore, writeResearchPack } from "./helpers";

function request(tool: ActionRequest["tool"], args: Record<string, unknown>): ActionRequest {
  return { id: id("req"), taskId: "tsk_test", tool, args, requestedBy: "agent" };
}

describe("Milestone 1 quality loop", () => {
  it("inspects, finds draft problems, corrects, and inspects again", async () => {
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

    const tools = store.readAudit(brief.id).map((event) => event.tool);
    expect(tools.filter((tool) => tool === "artifact.inspect").length).toBeGreaterThanOrEqual(2);
    expect(tools.filter((tool) => tool === "quality.check").length).toBeGreaterThanOrEqual(1);
    expect(tools).toContain("spreadsheet.update");
    expect(task.status).toBe("awaiting_review");
    expect(task.plan?.steps.find((step) => step.id === "correct")?.status).toBe("done");
    expect(task.plan?.steps.find((step) => step.id === "reinspect")?.status).toBe("done");
  });

  it("refuses to overwrite immutable source originals", () => {
    const store = tempStore();
    const workspace = new TaskWorkspace(store.workspaceRoot("tsk_lock"));
    expect(() => workspace.writeBytes("sources/secret.md", "nope")).toThrow(/immutable/);
    expect(() => workspace.writeBytes("originals/secret.md", "nope")).toThrow(/immutable/);
  });

  it("denies a tool when the capability is not granted", () => {
    const capabilities = defaultKnowledgeWorkCapabilities("/tmp/ws");
    capabilities.granted = capabilities.granted.filter((item) => item !== "spreadsheet:create");
    expect(
      evaluatePolicy(request("spreadsheet.create", { filename: "x.xlsx" }), capabilities).decision,
    ).toBe("deny");
  });
});

describe("Milestone 1 benchmark", () => {
  it("completes the market comparison with citations, conflict flags, and both artifacts", async () => {
    const store = tempStore();
    const { task } = await runBenchmarkTask(store);
    expect(task.status).toBe("awaiting_review");
    expect(task.companies?.length).toBeGreaterThanOrEqual(15);
    expect(task.artifacts.some((item) => item.kind === "spreadsheet" && item.validated)).toBe(true);
    expect(task.artifacts.some((item) => item.kind === "presentation" && item.validated)).toBe(true);
    expect(task.uncertainties?.some((flag) => /cedar|12 million|18 million|conflict/i.test(flag.note))).toBe(true);
    expect(task.evaluation?.selfReviewCycles).toBeGreaterThanOrEqual(1);
    expect(task.evaluation?.artifactCompleteness).toBe(1);
    expect(task.evaluation?.factualAccuracy).toBeGreaterThanOrEqual(0.8);
    expect(task.evaluation?.sendableAfterOneReview).toBe(true);
    expect(task.quality?.sendableAfterOneReview).toBe(true);
    expect(task.quality?.deliveryScore).toBe(1);
    expect((task.qualityDraft?.issues.length ?? 0) > (task.quality?.issues.length ?? 0)).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith(".pdf"))).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith(".xlsx"))).toBe(true);
    expect(task.identity?.status).toBe("active");
    expect(packName(task)).toBe("market");
    expect(task.review?.interventions ?? 0).toBe(0);
    expect(task.brief.approvedDestinations).toEqual([
      "https://notes.lakeshore.example/mossline-customers",
    ]);
    expect(task.identity?.granted).toContain("network:fetch:allowlist");
    expect(task.identity?.denied).toContain("network:fetch");
    const mossline = task.companies?.find((company) => /Mossline Shelters/i.test(company.name));
    expect(mossline?.customers).toMatch(/Hill Country wineries/i);
    expect(mossline?.sources.some((source) => /mossline-customers/i.test(source))).toBe(true);
    const fetches = store
      .readAudit(task.brief.id)
      .filter((event) => event.tool === "network.fetch" && event.action === "policy.decide");
    expect(
      fetches.some(
        (event) =>
          event.decision === "allow" &&
          String(event.details.reason ?? "").includes("notes.lakeshore.example/mossline-customers"),
      ),
    ).toBe(true);
    expect(
      fetches.some(
        (event) =>
          event.decision === "deny" &&
          String(event.details.reason ?? "").includes("news.example"),
      ),
    ).toBe(true);
    expect(
      fetches.some((event) =>
        String(event.details.reason ?? "").includes("notes.fir-ridge.example"),
      ),
    ).toBe(false);
    expect(task.identity?.granted.length).toBeGreaterThan(0);
    expect(task.governance?.deniedActions).toBeGreaterThanOrEqual(1);
    expect(task.governance?.crossTaskAccessAttempts).toBeGreaterThanOrEqual(1);
    expect(task.isolation?.status).toBe("destroyed");
  }, 60_000);
});
