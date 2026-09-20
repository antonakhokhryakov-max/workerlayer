import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "@aether/agent";
import { defaultKnowledgeWorkCapabilities, evaluatePolicy } from "@aether/control-plane";
import type { ActionRequest } from "@aether/contracts";
import { id } from "@aether/contracts";
import { newBrief, runKnowledgeTask } from "@aether/runtime";
import { TaskWorkspace, checkQuality, createPresentation, createSpreadsheet } from "@aether/workstation";
import { tempStore, writeResearchPack } from "./helpers";

function request(tool: ActionRequest["tool"], args: Record<string, unknown>): ActionRequest {
  return { id: id("req"), taskId: "tsk_test", tool, args, requestedBy: "agent" };
}

describe("Milestone 2 quality and workstation", () => {
  it("opens PDFs and spreadsheets through policy and raises the delivery score", async () => {
    const store = tempStore();
    const brief = newBrief(
      "Research this company using the attached materials. Produce a spreadsheet and presentation. Cite sources and flag uncertainty.",
      [
        { name: "company-brief.md", relativePath: "sources/company-brief.md" },
        { name: "notes.txt", relativePath: "sources/notes.txt" },
        { name: "memo.pdf", relativePath: "sources/memo.pdf" },
        { name: "metrics.xlsx", relativePath: "sources/metrics.xlsx" },
      ],
    );
    await writeResearchPack(store.workspaceRoot(brief.id));
    const { task } = await runKnowledgeTask(brief, {
      store,
      model: new DeterministicProvider(),
    });

    expect(task.status).toBe("awaiting_review");
    expect(task.openedFiles?.some((path) => path.endsWith(".pdf"))).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith(".xlsx"))).toBe(true);
    expect(task.qualityDraft?.sendableAfterOneReview).not.toBe(true);
    expect(task.quality?.sendableAfterOneReview).toBe(true);
    expect(task.quality?.deliveryScore ?? 0).toBeGreaterThan(task.qualityDraft?.deliveryScore ?? 0);
    expect(task.quality?.issues.length ?? 99).toBeLessThan(task.qualityDraft?.issues.length ?? 0);
    expect(task.identity?.status).toBe("active");
    expect(store.readAudit(brief.id).some((event) => event.decision === "deny")).toBe(true);
  });

  it("flags a deck that drops spreadsheet numbers", async () => {
    const store = tempStore();
    const workspace = new TaskWorkspace(store.workspaceRoot("tsk_quality"));
    workspace.writeBytes(
      "findings.json",
      JSON.stringify({
        company: "Northwind Lantern Co.",
        findings: [
          {
            category: "Metric",
            finding: "Revenue: $6.4 million last year",
            evidence: "$6.4 million",
            source: "memo.pdf",
            confidence: "high",
          },
        ],
        companies: [],
        uncertainties: [],
      }),
    );
    await createSpreadsheet(workspace, "findings.xlsx", "Draft", [
      { name: "Summary", rows: [["Field", "Value"], ["Revenue", "$6.4 million"]] },
      { name: "Findings", rows: [["#", "Finding"], [1, "Revenue: $6.4 million last year"]] },
      { name: "Sources", rows: [["ID", "Source"], ["S1", "memo.pdf"]] },
    ]);
    await createPresentation(workspace, "briefing.pptx", "Draft", [
      { title: "Overview", bullets: ["A briefing with the number removed."] },
      { title: "Sources cited", bullets: ["S1 memo.pdf"] },
      { title: "Uncertainty and gaps", bullets: ["Single-source pack."] },
    ]);

    const draft = await checkQuality(workspace);
    expect(draft.issues.some((issue) => issue.code === "consistency.numbers_not_in_deck")).toBe(true);
    expect(draft.sendableAfterOneReview).toBe(false);

    await createPresentation(workspace, "briefing.pptx", "Corrected", [
      { title: "Overview", bullets: ["Revenue is $6.4 million last year."] },
      { title: "Sources cited", bullets: ["S1 memo.pdf"] },
      { title: "Uncertainty and gaps", bullets: ["Single-source pack."] },
    ]);
    const corrected = await checkQuality(workspace);
    expect(corrected.issues.some((issue) => issue.code === "consistency.numbers_not_in_deck")).toBe(false);
    expect(corrected.deliveryScore ?? 0).toBeGreaterThan(draft.deliveryScore ?? 0);
  });

  it("denies opening another task's spreadsheet", () => {
    const capabilities = defaultKnowledgeWorkCapabilities("/tmp/ws");
    expect(
      evaluatePolicy(
        request("spreadsheet.open", { path: "tsk_other/sources/payroll.xlsx" }),
        capabilities,
      ).decision,
    ).toBe("deny");
    expect(
      evaluatePolicy(request("pdf.open", { path: "sources/memo.pdf" }), capabilities).decision,
    ).toBe("allow");
  });
});
