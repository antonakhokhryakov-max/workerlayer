import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "@aether/agent";
import { newBrief, runKnowledgeTask } from "@aether/runtime";
import { tempStore, writeResearchPack } from "./helpers";

describe("knowledge-work workflow", () => {
  it("submits a task, plans, reads sources, and produces spreadsheet, deck, and summary", async () => {
    const store = tempStore();
    const brief = newBrief(
      "Research this company using the attached materials. Analyze the information, produce a supporting spreadsheet and prepare a short presentation summarizing the most important findings. Cite sources and flag uncertainty.",
      [
        { name: "company-brief.md", relativePath: "sources/company-brief.md" },
        { name: "notes.txt", relativePath: "sources/notes.txt" },
        { name: "memo.pdf", relativePath: "sources/memo.pdf" },
      ],
    );
    await writeResearchPack(store.workspaceRoot(brief.id));

    const { task, auditCount } = await runKnowledgeTask(brief, {
      store,
      model: new DeterministicProvider(),
    });

    expect(task.status).toBe("awaiting_review");
    expect(task.plan?.steps.map((step) => step.id)).toEqual([
      "list",
      "read",
      "desk",
      "ocr",
      "research",
      "scope",
      "analyze",
      "spreadsheet",
      "sandbox",
      "presentation",
      "document",
      "inspect",
      "review",
      "correct",
      "reinspect",
      "validate",
    ]);
    expect(task.plan?.steps.every((step) => step.status === "done")).toBe(true);
    expect(task.company).toMatch(/Northwind Lantern/i);
    expect(task.findings.length).toBeGreaterThanOrEqual(3);
    expect(task.artifacts.map((item) => item.kind).sort()).toEqual([
      "document",
      "presentation",
      "spreadsheet",
    ]);
    expect(task.artifacts.every((item) => item.validated)).toBe(true);

    for (const artifact of task.artifacts) {
      expect(existsSync(join(store.workspaceRoot(brief.id), artifact.relativePath))).toBe(true);
    }
    expect(auditCount).toBeGreaterThan(8);
  });
});
