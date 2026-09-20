import { KnowledgeWorker, createModelProvider } from "@aether/agent";
import type { ModelProvider } from "@aether/agent";
import { defaultKnowledgeWorkCapabilities } from "@aether/control-plane";
import { registerWorker, type VerticalPlanner } from "@aether/runtime";

export const KNOWLEDGE_KIND = "knowledge";

function knowledgePlanner(model: ModelProvider): VerticalPlanner {
  const worker = new KnowledgeWorker(model);
  return {
    plan: (brief) => worker.plan(brief),
    nextIntent: (brief) => worker.nextIntent(brief),
    observe: (handled) => worker.observe(handled),
    applyToTask: (task) => {
      task.plan = worker.memory.plan;
      task.findings = worker.memory.findings;
      task.citations = worker.memory.citations;
      task.uncertainties = worker.memory.uncertainties;
      task.companies = worker.memory.companies;
      task.quality = worker.memory.latestQuality();
      task.qualityDraft = worker.memory.qualityReports[0];
      task.openedFiles = [...worker.memory.openedPaths];
      task.researchNotes = worker.memory.research;
      task.company = worker.memory.company;
      task.summary = worker.memory.summary;
    },
    isDelivered: () => worker.memory.validated,
    hydrate: (task) => {
      const memory = worker.memory;
      memory.plan = task.plan;
      memory.findings = task.findings;
      memory.citations = task.citations ?? [];
      memory.uncertainties = task.uncertainties ?? [];
      memory.companies = task.companies ?? [];
      memory.research = task.researchNotes;
      memory.company = task.company;
      memory.summary = task.summary;
      memory.attemptedGapFill = true;
      memory.attemptedApprovedFetch = true;
      memory.attemptedCrossTask = true;
      memory.attemptedSandbox = true;
      memory.inspectCount = 2;
      memory.correctionsApplied = 3;
      if (task.qualityDraft) memory.qualityReports.push(task.qualityDraft);
      if (task.quality && task.quality !== task.qualityDraft) memory.qualityReports.push(task.quality);
      for (const path of task.openedFiles ?? []) memory.openedPaths.add(path);
      for (const artifact of task.artifacts) {
        if (artifact.kind === "spreadsheet" || artifact.kind === "presentation" || artifact.kind === "document") {
          memory.created[artifact.kind] = artifact.relativePath;
          if (artifact.validated) memory.validatedPaths.add(artifact.relativePath);
        }
      }
    },
    beginFix: (target) => worker.beginHumanFix(target),
  };
}

/** Host calls this after loadVerticals / loadHostVerticals. Idempotent. */
export function register(): void {
  registerWorker({
    kind: KNOWLEDGE_KIND,
    name: "WorkerLayer knowledge worker",
    statusWhileRunning:
      "The knowledge worker is working — plan, execute, inspect, correct, then deliver. You do not need to prompt it.",
    capabilities: (brief, workspaceRoot) =>
      defaultKnowledgeWorkCapabilities(workspaceRoot, brief.approvedDestinations),
    createPlanner: (ctx) => knowledgePlanner(ctx.model ?? createModelProvider()),
  });
}
