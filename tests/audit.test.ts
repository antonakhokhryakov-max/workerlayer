import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "@aether/agent";
import { newBrief, runKnowledgeTask } from "@aether/runtime";
import { tempStore, writeResearchPack } from "./helpers";

describe("audit trail", () => {
  it("records meaningful actions for a completed task", async () => {
    const store = tempStore();
    const brief = newBrief("Produce a research spreadsheet from the attached pack.", [
      { name: "company-brief.md", relativePath: "sources/company-brief.md" },
      { name: "notes.txt", relativePath: "sources/notes.txt" },
      { name: "memo.pdf", relativePath: "sources/memo.pdf" },
    ]);
    await writeResearchPack(store.workspaceRoot(brief.id));
    await runKnowledgeTask(brief, { store, model: new DeterministicProvider() });

    const events = store.readAudit(brief.id);
    const actions = events.map((event) => event.action);

    expect(actions).toContain("task.submitted");
    expect(actions).toContain("plan.created");
    expect(actions).toContain("action.requested");
    expect(actions).toContain("policy.decide");
    expect(actions).toContain("grant.issue");
    expect(actions).toContain("workstation.execute");
    expect(actions).toContain("task.finished");
    expect(actions).toContain("environment.created");
    expect(actions).toContain("environment.destroyed");
    expect(actions).toContain("environment.probe");

    const tools = events
      .filter((event) => event.action === "action.requested")
      .map((event) => event.tool);
    expect(tools).toContain("workspace.list_files");
    expect(tools).toContain("analysis.record_findings");
    expect(tools.some((tool) => tool === "pdf.open" || tool === "pdf.extract_text" || tool === "workspace.ingest_sources")).toBe(true);
    expect(tools).toContain("spreadsheet.open");
    expect(tools).toContain("research.review_sources");
    expect(tools).toContain("spreadsheet.create");
    expect(tools).toContain("presentation.create");
    expect(tools).toContain("document.create");
    expect(tools).toContain("artifact.inspect");
    expect(tools).toContain("quality.check");
    expect(tools).toContain("artifact.validate");

    const decisions = events.filter((event) => event.action === "policy.decide");
    expect(decisions.some((event) => event.decision === "allow")).toBe(true);
    expect(decisions.some((event) => event.decision === "deny")).toBe(true);
    expect(decisions.length).toBeGreaterThanOrEqual(6);
  });
});
