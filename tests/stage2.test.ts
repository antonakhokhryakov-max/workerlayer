import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "@aether/agent";
import { defaultKnowledgeWorkCapabilities, evaluatePolicy } from "@aether/control-plane";
import type { ActionRequest } from "@aether/contracts";
import { id } from "@aether/contracts";
import { newBrief, runKnowledgeTask } from "@aether/runtime";
import { tempStore, writeResearchPack } from "./helpers";

function request(tool: ActionRequest["tool"], args: Record<string, unknown>): ActionRequest {
  return {
    id: id("req"),
    taskId: "tsk_test",
    tool,
    args,
    requestedBy: "agent",
  };
}

describe("Stage 2 multi-artifact knowledge work", () => {
  it("cites sources, flags uncertainty, and writes three professional artifacts", async () => {
    const store = tempStore();
    const brief = newBrief(
      "Research this company using the attached materials. Cite sources and flag uncertainty.",
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
    expect(task.citations?.length).toBeGreaterThanOrEqual(2);
    expect(task.findings.some((finding) => finding.citationId)).toBe(true);
    expect(task.uncertainties?.length).toBeGreaterThanOrEqual(1);
    expect(task.findings.some((finding) => finding.uncertain) || (task.uncertainties?.length ?? 0) > 0).toBe(true);
    expect(task.researchNotes?.method).toBe("attached-materials-only");
    expect(task.researchNotes?.gaps.length).toBeGreaterThan(0);

    const spreadsheet = task.artifacts.find((item) => item.kind === "spreadsheet");
    const presentation = task.artifacts.find((item) => item.kind === "presentation");
    const document = task.artifacts.find((item) => item.kind === "document");
    expect(spreadsheet && presentation && document).toBeTruthy();

    const root = store.workspaceRoot(brief.id);
    const markdown = readFileSync(join(root, document!.relativePath), "utf8");
    expect(markdown).toMatch(/Sources/i);
    expect(markdown).toMatch(/Uncertain/i);
    expect(markdown).toMatch(/\[S\d+\]/);

    const sidecar = join(root, presentation!.relativePath.replace(/\.pptx$/i, ".slides.json"));
    expect(existsSync(sidecar)).toBe(true);
    const slides = JSON.parse(readFileSync(sidecar, "utf8")) as {
      slides: Array<{ title: string }>;
    };
    expect(slides.slides.some((slide) => /source|citation/i.test(slide.title))).toBe(true);
    expect(slides.slides.some((slide) => /uncertain|gap/i.test(slide.title))).toBe(true);
  });

  it("still denies unauthorized presentation and document destinations", () => {
    const capabilities = defaultKnowledgeWorkCapabilities("/tmp/aether-ws");
    expect(
      evaluatePolicy(
        request("presentation.create", { filename: "../outside.pptx" }),
        capabilities,
      ).decision,
    ).toBe("deny");
    expect(
      evaluatePolicy(
        request("document.create", { filename: "/etc/summary.md" }),
        capabilities,
      ).decision,
    ).toBe("deny");
  });
});
