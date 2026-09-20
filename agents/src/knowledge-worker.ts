import type {
  ActionRequest,
  AgentIntent,
  FixTarget,
  HandledAction,
  TaskBrief,
  WorkPlan,
} from "@aether/contracts";
import { id } from "@aether/contracts";
import { requestedSlideCount, spreadsheetFromAnalysis, synthesizeAnalysis } from "./analysis";
import { documentFromAnalysis, presentationFromAnalysis } from "./deliverables";
import { WorkingMemory } from "./memory";
import type { ModelProvider } from "./models/provider";
import { draftKnowledgeWorkPlan, markStep } from "./planning";

/**
 * First-party knowledge-work agent.
 * Plans and proposes tool requests. Does not authorize or execute.
 */
export class KnowledgeWorker {
  readonly memory = new WorkingMemory();

  constructor(private readonly model: ModelProvider) {}

  plan(task: TaskBrief): WorkPlan {
    const plan = draftKnowledgeWorkPlan(task);
    this.memory.plan = plan;
    return plan;
  }

  observe(handled: HandledAction): void {
    const inspectBefore = this.memory.inspectCount;
    this.memory.remember(handled);
    if (!this.memory.plan) return;
    if (handled.request.tool === "workspace.list_files" && handled.result.ok) {
      this.memory.plan = markStep(this.memory.plan, "list", "done");
    }
    if (
      (handled.request.tool === "workspace.read_file" ||
        handled.request.tool === "pdf.extract_text" ||
        handled.request.tool === "pdf.open" ||
        handled.request.tool === "pdf.ocr" ||
        handled.request.tool === "spreadsheet.open" ||
        handled.request.tool === "workspace.ingest_sources") &&
      this.memory.unreadSources().length === 0
    ) {
      this.memory.plan = markStep(this.memory.plan, "read", "done");
    }
    if (this.memory.unopenedWorkingFiles().length === 0 && this.memory.listedFiles().length > 0) {
      this.memory.plan = markStep(this.memory.plan, "desk", "done");
    }
    if (this.memory.listedFiles().length > 0 && this.memory.sourcesNeedingOcr().length === 0) {
      this.memory.plan = markStep(this.memory.plan, "ocr", "done");
    }
    if (handled.request.tool === "research.review_sources" && handled.result.ok) {
      this.memory.plan = markStep(this.memory.plan, "research", "done");
    }
    if (this.memory.attemptedGapFill && this.memory.attemptedCrossTask) {
      this.memory.plan = markStep(this.memory.plan, "scope", "done");
    }
    if (handled.request.tool === "analysis.record_findings" && handled.result.ok) {
      this.memory.plan = markStep(this.memory.plan, "analyze", "done");
    }
    if (handled.request.tool === "spreadsheet.create" && handled.result.ok) {
      this.memory.plan = markStep(this.memory.plan, "spreadsheet", "done");
    }
    if (handled.request.tool === "python.execute") {
      this.memory.plan = markStep(this.memory.plan, "sandbox", "done");
    }
    if (handled.request.tool === "presentation.create" && this.memory.correctionsApplied === 0 && handled.result.ok) {
      this.memory.plan = markStep(this.memory.plan, "presentation", "done");
    }
    if (handled.request.tool === "document.create" && handled.result.ok) {
      this.memory.plan = markStep(this.memory.plan, "document", "done");
    }
    if (handled.request.tool === "artifact.inspect" && inspectBefore === 0) {
      this.memory.plan = markStep(this.memory.plan, "inspect", "done");
    }
    if (handled.request.tool === "quality.check" && handled.result.ok) {
      this.memory.plan = markStep(this.memory.plan, "review", "done");
    }
    if (this.memory.correctionsApplied >= 1) {
      this.memory.plan = markStep(this.memory.plan, "correct", "done");
    }
    if (this.memory.inspectCount >= 2) {
      this.memory.plan = markStep(this.memory.plan, "reinspect", "done");
    }
    if (this.memory.allDeliverablesReady) {
      this.memory.plan = markStep(this.memory.plan, "validate", "done");
    }
    if (this.memory.humanFix?.checked) {
      this.memory.plan = markStep(this.memory.plan, "human_fix", "done");
    }
  }

  beginHumanFix(target: FixTarget): void {
    this.memory.humanFix = { target, applied: false, inspected: false, checked: false };
    if (this.memory.plan && !this.memory.plan.steps.some((step) => step.id === "human_fix")) {
      this.memory.plan = {
        ...this.memory.plan,
        steps: [
          ...this.memory.plan.steps,
          {
            id: "human_fix",
            title: "Apply the requested fix",
            detail: "One structured correction pass from the review, then re-score.",
            status: "in_progress",
          },
        ],
      };
    }
  }

  async nextIntent(task: TaskBrief): Promise<AgentIntent> {
    const request = (tool: ActionRequest["tool"], args: Record<string, unknown>, rationale: string): ActionRequest => ({
      id: id("req"),
      taskId: task.id,
      tool,
      args,
      requestedBy: "agent",
      rationale,
    });

    if (this.memory.humanFix) {
      return this.nextFixIntent(task, request);
    }

    if (this.memory.listedFiles().length === 0) {
      return {
        type: "request",
        request: request("workspace.list_files", {}, "Inventory files in the governed task environment."),
      };
    }

    const unread = this.memory.unreadSources();
    if (unread.length > 3) {
      return {
        type: "request",
        request: request(
          "workspace.ingest_sources",
          {},
          "Read all attached sources in one governed pass.",
        ),
      };
    }
    if (unread.length > 0) {
      const path = unread[0];
      const lower = path.toLowerCase();
      const tool = lower.endsWith(".pdf")
        ? "pdf.open"
        : lower.endsWith(".xlsx") || lower.endsWith(".xls")
          ? "spreadsheet.open"
          : "workspace.read_file";
      return {
        type: "request",
        request: request(tool, { path }, `Open attached source ${path} in the task workstation.`),
      };
    }

    const unopened = this.memory.unopenedWorkingFiles();
    if (unopened.length > 0) {
      const path = unopened[0];
      const tool = path.toLowerCase().endsWith(".pdf") ? "pdf.open" : "spreadsheet.open";
      return {
        type: "request",
        request: request(
          tool,
          { path },
          `Open ${path} as a working file in the governed workstation.`,
        ),
      };
    }

    const needsOcr = this.memory.sourcesNeedingOcr();
    if (needsOcr.length > 0) {
      return {
        type: "request",
        request: request(
          "pdf.ocr",
          { path: needsOcr[0] },
          `PDF ${needsOcr[0]} has no usable text layer. Request OCR in the governed workstation. Do not invent unread numbers.`,
        ),
      };
    }

    if (!this.memory.research) {
      return {
        type: "request",
        request: request(
          "research.review_sources",
          {},
          "Review attached materials only: coverage, gaps, and uncertainty.",
        ),
      };
    }

    if (this.memory.research && !this.memory.attemptedGapFill) {
      const gap = this.memory.research.gaps[0] ?? "Attached materials leave facts unverified.";
      return {
        type: "request",
        request: request(
          "network.fetch",
          { url: "https://news.example/search" },
          `Research gaps remain (${gap}). Fetch public coverage to fill missing facts.`,
        ),
      };
    }

    if (this.memory.research && this.memory.attemptedGapFill && !this.memory.attemptedApprovedFetch) {
      const approved = this.memory.namedHttpUrls();
      if (approved.length > 0) {
        return {
          type: "request",
          request: request(
            "network.fetch",
            { url: approved[0] },
            `Request the destination named in the attached pack (${approved[0]}). The control plane decides if it is on this assignment's allowlist.`,
          ),
        };
      }
      this.memory.attemptedApprovedFetch = true;
    }

    if (this.memory.research && !this.memory.attemptedCrossTask) {
      return {
        type: "request",
        request: request(
          "workspace.read_file",
          { path: "tsk_payroll/sources/payroll.csv" },
          "Compensation figures are missing from the attached pack. Read the payroll extract if it is available.",
        ),
      };
    }

    if (this.memory.findings.length === 0) {
      const analysis = await synthesizeAnalysis(
        this.model,
        this.memory.sources,
        task.goal,
        this.memory.research,
      );
      return {
        type: "request",
        request: request(
          "analysis.record_findings",
          { ...analysis },
          "Record cited findings, company comparison, and uncertainty flags.",
        ),
      };
    }

    const recorded = this.memory.recordedAnalysis();
    const slidesWanted = requestedSlideCount(task.goal, this.memory.companies.length);

    if (!this.memory.created.spreadsheet) {
      return {
        type: "request",
        request: request(
          "spreadsheet.create",
          spreadsheetFromAnalysis(recorded, task.goal, "draft"),
          "Create the first spreadsheet draft.",
        ),
      };
    }

    if (!this.memory.attemptedSandbox) {
      const names = this.memory.companies.map((company) => company.name);
      return {
        type: "request",
        request: request(
          "python.execute",
          {
            source: [
              "import json",
              "from pathlib import Path",
              "root = Path('.')",
              "findings = {}",
              "path = root / 'findings.json'",
              "if path.exists():",
              "    findings = json.loads(path.read_text())",
              "companies = findings.get('companies') or []",
              "out = {",
              "    'ok': True,",
              "    'substrate': 'SANDBOX',",
              `    'expected': ${names.length},`,
              "    'companies': len(companies),",
              "    'names': [c.get('name') for c in companies if isinstance(c, dict)],",
              "}",
              "dest = root / 'artifacts' / 'sandbox-verify.json'",
              "dest.write_text(json.dumps(out, indent=2))",
              "print(json.dumps(out))",
              "",
            ].join("\n"),
          },
          "Verify the recorded company count inside the assignment sandbox. The control plane decides whether this runs.",
        ),
      };
    }

    if (!this.memory.created.presentation) {
      return {
        type: "request",
        request: request(
          "presentation.create",
          presentationFromAnalysis(recorded, this.memory.research, task.goal, "draft"),
          "Create the first presentation draft.",
        ),
      };
    }

    if (!this.memory.created.document) {
      return {
        type: "request",
        request: request(
          "document.create",
          documentFromAnalysis(recorded, this.memory.research, task.goal),
          "Write the short summary with citations and uncertainty flags.",
        ),
      };
    }

    if (this.memory.inspectCount === 0) {
      return {
        type: "request",
        request: request("artifact.inspect", {}, "Inspect the draft artifacts."),
      };
    }

    if (this.memory.qualityReports.length === 0) {
      return {
        type: "request",
        request: request(
          "quality.check",
          { requestedSlides: slidesWanted },
          "Check the draft for missing sheets, slide count, citations, and conflicts.",
        ),
      };
    }

    const latest = this.memory.latestQuality();
    if (this.memory.correctionsApplied === 0) {
      const needsSpreadsheet =
        latest?.issues.some((issue) => issue.artifact === "spreadsheet" || issue.code.startsWith("spreadsheet")) ?? true;
      if (needsSpreadsheet || !latest?.ok) {
        return {
          type: "request",
          request: request(
            "spreadsheet.update",
            spreadsheetFromAnalysis(recorded, task.goal, "corrected"),
            "Correct the spreadsheet after the quality check.",
          ),
        };
      }
      return {
        type: "request",
        request: request(
          "presentation.create",
          presentationFromAnalysis(recorded, this.memory.research, task.goal, "corrected"),
          "Correct the presentation after the quality check.",
        ),
      };
    }

    if (
      this.memory.correctionsApplied < 3 &&
      latest &&
      !latest.ok &&
      latest.issues.some(
        (issue) =>
          issue.artifact === "presentation" || issue.code.startsWith("consistency"),
      )
    ) {
      return {
        type: "request",
        request: request(
          "presentation.create",
          presentationFromAnalysis(recorded, this.memory.research, task.goal, "corrected"),
          "Align the deck with spreadsheet names, numbers, and conclusions.",
        ),
      };
    }

    if (this.memory.inspectCount < 2) {
      return {
        type: "request",
        request: request("artifact.inspect", {}, "Inspect the corrected artifacts."),
      };
    }

    if (this.memory.qualityReports.length < 2) {
      return {
        type: "request",
        request: request(
          "quality.check",
          { requestedSlides: slidesWanted },
          "Re-check after correction.",
        ),
      };
    }

    if (latest && !latest.ok && this.memory.inspectCount <= this.memory.correctionsApplied) {
      return {
        type: "request",
        request: request("artifact.inspect", {}, "Inspect again after aligning the artifacts."),
      };
    }

    if (latest && !latest.ok && this.memory.qualityReports.length <= this.memory.correctionsApplied) {
      return {
        type: "request",
        request: request(
          "quality.check",
          { requestedSlides: slidesWanted },
          "Score the corrected pack: would a user send this after one review?",
        ),
      };
    }

    const pending = this.memory.unvalidatedPaths();
    if (pending.length > 0) {
      return {
        type: "request",
        request: request("artifact.validate", { path: pending[0] }, `Validate ${pending[0]}.`),
      };
    }

    return {
      type: "finish",
      summary:
        this.memory.summary ??
        "Finished the assignment after a review-and-correction cycle.",
    };
  }

  private nextFixIntent(
    task: TaskBrief,
    request: (
      tool: ActionRequest["tool"],
      args: Record<string, unknown>,
      rationale: string,
    ) => ActionRequest,
  ): AgentIntent {
    const fix = this.memory.humanFix!;
    const recorded = this.memory.recordedAnalysis();
    const slidesWanted = requestedSlideCount(task.goal, this.memory.companies.length);

    if (!fix.applied) {
      fix.applied = true;
      if (fix.target === "citations") {
        return {
          type: "request",
          request: request(
            "document.create",
            documentFromAnalysis(recorded, this.memory.research, task.goal),
            "Requested fix: cite sources more clearly in the written summary.",
          ),
        };
      }
      if (fix.target === "uncertainty" || fix.target === "consistency") {
        return {
          type: "request",
          request: request(
            "spreadsheet.update",
            spreadsheetFromAnalysis(recorded, task.goal, "corrected"),
            `Requested fix: ${fix.target === "uncertainty" ? "restore uncertainty flags" : "align spreadsheet names and numbers"}.`,
          ),
        };
      }
      return {
        type: "request",
        request: request(
          "presentation.create",
          presentationFromAnalysis(recorded, this.memory.research, task.goal, "corrected"),
          "Requested fix: rebuild the deck so slides are complete.",
        ),
      };
    }

    if (fix.target !== "slides" && fix.target !== "citations" && !fix.inspected) {
      const last = this.memory.observations.at(-1);
      if (last?.request.tool === "spreadsheet.update") {
        return {
          type: "request",
          request: request(
            "presentation.create",
            presentationFromAnalysis(recorded, this.memory.research, task.goal, "corrected"),
            "Requested fix: align the deck with the spreadsheet after the correction.",
          ),
        };
      }
    }

    if (!fix.inspected) {
      fix.inspected = true;
      return {
        type: "request",
        request: request("artifact.inspect", {}, "Inspect artifacts after the requested fix."),
      };
    }

    if (!fix.checked) {
      fix.checked = true;
      return {
        type: "request",
        request: request(
          "quality.check",
          { requestedSlides: slidesWanted },
          "Re-score after the requested fix. Would a user send this after one review?",
        ),
      };
    }

    const pending = this.memory.unvalidatedPaths();
    if (pending.length > 0) {
      return {
        type: "request",
        request: request("artifact.validate", { path: pending[0] }, `Validate ${pending[0]}.`),
      };
    }

    return {
      type: "finish",
      summary: `Applied one requested fix (${fix.target}) and re-scored the pack.`,
    };
  }
}
