import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DeterministicProvider,
  extractCompanies,
  presentationFromAnalysis,
} from "@aether/agent";
import { newBrief, runKnowledgeTask } from "@aether/runtime";
import { TaskWorkspace, checkQuality, createPresentation, createSpreadsheet } from "@aether/workstation";
import { tempStore, writeTwoCompanyPack } from "./helpers";

describe("quality loop on weaker residual packs", () => {
  it("merges Harbor & Pine name splits into one company", () => {
    const companies = extractCompanies([
      {
        path: "sources/company-brief.md",
        text: "# Harbor & Pine Outdoor Co.\n\nFunding: $24 million\nProducts: teak dining",
      },
      {
        path: "sources/notes.txt",
        text: "# Harbor & Pine\n\nCustomers: coastal hotels",
      },
    ]);
    expect(companies.map((company) => company.name)).toEqual(["Harbor & Pine Outdoor Co."]);
    expect(companies[0]?.funding).toMatch(/24/);
    expect(companies[0]?.customers).toMatch(/hotel/i);
  });

  it("treats Harbor revenue as funding so the company card is complete", () => {
    const companies = extractCompanies([
      {
        path: "sources/company-brief.md",
        text: "# Harbor & Pine Outdoor Co.\n\nIndustry: Outdoor furniture\nRevenue: $24 million\nCustomers: coastal hotels\nProducts: teak dining",
      },
    ]);
    expect(companies).toHaveLength(1);
    expect(companies[0]?.funding).toMatch(/\$24 million/);
    expect(companies[0]?.businessModel).toMatch(/Outdoor furniture/i);
    expect(companies[0]?.missing).not.toContain("funding");
    expect(companies[0]?.missing).not.toContain("businessModel");
  });

  it("builds a short comparison deck, not a 10-slide market deck, for two companies", () => {
    const deck = presentationFromAnalysis(
      {
        company: "2-company comparison",
        summary: "Northwind and Saltwell from attached materials.",
        findings: [
          {
            category: "Metric",
            finding: "Revenue: $6.4 million",
            evidence: "$6.4 million",
            source: "addendum.pdf",
            confidence: "high",
          },
        ],
        citations: [{ id: "S1", source: "addendum.pdf", path: "sources/addendum.pdf" }],
        uncertainties: [{ id: "U1", note: "Single-source pack.", reason: "unverified" }],
        companies: [
          {
            name: "Northwind Lantern Co.",
            funding: "$6.4 million",
            sources: ["northwind.md"],
            missing: [],
            conflicts: [],
          },
          {
            name: "Saltwell Canvas",
            funding: "$2.1 million",
            sources: ["saltwell.md"],
            missing: [],
            conflicts: [],
          },
        ],
      },
      { method: "attached-materials-only", sources: [], coverage: ["Attached pack"], gaps: [], notes: [] },
      "Compare the two companies. Produce a spreadsheet and a short presentation.",
      "corrected",
    );
    expect(deck.slides.length).toBeLessThan(10);
    expect(deck.slides.every((slide) => slide.bullets.length > 0)).toBe(true);
    const text = deck.slides.flatMap((slide) => [slide.title, ...slide.bullets]).join("\n");
    expect(text).toMatch(/Northwind/);
    expect(text).toMatch(/Saltwell/);
    expect(text).toMatch(/\$6\.4 million/);
    expect(text).toMatch(/\$2\.1 million/);
    expect(deck.slides.some((slide) => /source/i.test(slide.title))).toBe(true);
    expect(deck.slides.some((slide) => /uncertain|gap|conflict/i.test(slide.title))).toBe(true);
  });

  it("treats $24M on the deck as the same figure as $24 million", async () => {
    const store = tempStore();
    const workspace = new TaskWorkspace(store.workspaceRoot("tsk_money"));
    workspace.writeBytes(
      "findings.json",
      JSON.stringify({
        company: "Harbor & Pine Outdoor Co.",
        findings: [
          {
            category: "Metric",
            finding: "Revenue: $24 million",
            evidence: "$24 million",
            source: "memo.pdf",
            confidence: "high",
          },
        ],
        companies: [
          {
            name: "Harbor & Pine Outdoor Co.",
            funding: "$24 million",
            sources: ["memo.pdf"],
            missing: [],
            conflicts: [],
          },
        ],
        uncertainties: [],
      }),
    );
    await createSpreadsheet(workspace, "findings.xlsx", "Draft", [
      { name: "Summary", rows: [["Field", "Value"], ["Funding", "$24 million"]] },
      { name: "Findings", rows: [["#", "Finding"], [1, "Revenue: $24 million"]] },
      { name: "Sources", rows: [["ID", "Source"], ["S1", "memo.pdf"]] },
      { name: "Uncertainty", rows: [["ID", "Note"], ["U1", "Single source"]] },
    ]);
    await createPresentation(workspace, "briefing.pptx", "Corrected", [
      { title: "Overview", bullets: ["Funding is $24M in the attached memo."] },
      { title: "Sources cited", bullets: ["S1 memo.pdf"] },
      { title: "Uncertainty and gaps", bullets: ["Single-source pack."] },
    ]);
    const report = await checkQuality(workspace);
    expect(report.issues.some((issue) => issue.code === "consistency.numbers_not_in_deck")).toBe(false);
  });

  it("finishes a two-company pack at 100 with zero interventions", async () => {
    const store = tempStore();
    const brief = newBrief(
      "Compare the two companies using the attached materials. Produce a supporting spreadsheet and a short presentation. Cite sources and flag uncertainty.",
      [
        { name: "northwind.md", relativePath: "sources/northwind.md" },
        { name: "saltwell.md", relativePath: "sources/saltwell.md" },
        { name: "addendum.pdf", relativePath: "sources/addendum.pdf" },
      ],
    );
    await writeTwoCompanyPack(store.workspaceRoot(brief.id));
    const { task } = await runKnowledgeTask(brief, {
      store,
      model: new DeterministicProvider(),
    });

    expect(task.status).toBe("awaiting_review");
    expect(task.review?.interventions ?? 0).toBe(0);
    expect(task.quality?.deliveryScore).toBe(1);
    expect(task.quality?.sendableAfterOneReview).toBe(true);
    expect(task.qualityDraft?.deliveryScore ?? 1).toBeLessThan(1);
    expect(task.identity?.status).toBe("active");
    expect(store.readAudit(brief.id).some((event) => event.decision === "deny")).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith(".pdf"))).toBe(true);
    expect((task.companies ?? []).map((company) => company.name).sort()).toEqual([
      "Northwind Lantern Co.",
      "Saltwell Canvas",
    ]);

    const presentation = task.artifacts.find((item) => item.kind === "presentation");
    expect(presentation).toBeTruthy();
    const sidecar = join(
      store.workspaceRoot(brief.id),
      presentation!.relativePath.replace(/\.pptx$/i, ".slides.json"),
    );
    expect(existsSync(sidecar)).toBe(true);
    const slides = JSON.parse(readFileSync(sidecar, "utf8")) as {
      slides: Array<{ title: string; bullets: string[] }>;
    };
    expect(slides.slides.every((slide) => slide.bullets.length > 0)).toBe(true);
    const text = slides.slides.flatMap((slide) => [slide.title, ...slide.bullets]).join("\n");
    expect(text).toMatch(/Northwind/);
    expect(text).toMatch(/Saltwell/);
    expect(text).toMatch(/\$6\.4 million/);
    expect(text).toMatch(/\$2\.1 million/);
  });
});
