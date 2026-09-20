import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EvaluationReport } from "@aether/contracts";
import { formatEffortLine, packLabel, packName, type StoredTask, type TaskStore } from "@aether/runtime";

export interface GroundTruth {
  companies: Array<{ name: string }>;
  incomplete: string[];
  conflicts: Array<{ name: string; field: string }>;
  requestedSlides: number;
}

export function loadGroundTruth(path: string): GroundTruth {
  return JSON.parse(readFileSync(path, "utf8")) as GroundTruth;
}

export function evaluateTask(
  task: StoredTask,
  store: TaskStore,
  truth: GroundTruth,
  runtimeMs: number,
): EvaluationReport {
  const notes: string[] = [];
  const kinds = new Set(task.artifacts.map((item) => item.kind));
  const artifactCompleteness =
    (Number(kinds.has("spreadsheet")) + Number(kinds.has("presentation"))) / 2;

  const citedFindings = task.findings.filter((finding) => finding.citationId || finding.source);
  const citationCoverage =
    task.findings.length === 0 ? 0 : citedFindings.length / task.findings.length;

  const named = new Set((task.companies ?? []).map((company) => company.name));
  const recalled = truth.companies.filter((company) => named.has(company.name)).length;
  const factualAccuracy = truth.companies.length === 0 ? 0 : recalled / truth.companies.length;
  if (recalled < truth.companies.length) {
    notes.push(`Comparison is missing ${truth.companies.length - recalled} companies.`);
  }

  const conflictFlagged = (task.uncertainties ?? []).some((flag) =>
    /cedar|conflict|12 million|18 million/i.test(flag.note),
  );
  if (!conflictFlagged) {
    notes.push("The planted Cedar & Current funding conflict was not clearly flagged.");
  }

  let visualDefects = 0;
  let deckText = "";
  const presentation = task.artifacts.find((item) => item.kind === "presentation");
  if (presentation) {
    const sidecar = join(
      store.workspaceRoot(task.brief.id),
      presentation.relativePath.replace(/\.pptx$/i, ".slides.json"),
    );
    if (existsSync(sidecar)) {
      const slides = (
        JSON.parse(readFileSync(sidecar, "utf8")) as { slides?: Array<{ title?: string; bullets?: string[] }> }
      ).slides ?? [];
      deckText = slides.flatMap((slide) => [slide.title ?? "", ...(slide.bullets ?? [])]).join("\n");
      if (slides.length < truth.requestedSlides - 1) {
        visualDefects += 1;
        notes.push(`Deck has ${slides.length} slides; about ${truth.requestedSlides} were requested.`);
      }
      visualDefects += slides.filter((slide) => (slide.bullets ?? []).length === 0).length;
    }
  }

  let sheetText = "";
  const spreadsheet = task.artifacts.find((item) => item.kind === "spreadsheet");
  if (spreadsheet) {
    const grid = join(
      store.workspaceRoot(task.brief.id),
      spreadsheet.relativePath.replace(/\.xlsx$/i, ".grid.json"),
    );
    if (existsSync(grid)) {
      const parsed = JSON.parse(readFileSync(grid, "utf8")) as {
        sheets?: Array<{ name?: string; rows?: Array<Array<string | number | null>> }>;
      };
      sheetText = (parsed.sheets ?? [])
        .flatMap((sheet) => [
          sheet.name ?? "",
          ...(sheet.rows ?? []).map((row) => row.map((cell) => String(cell ?? "")).join(" ")),
        ])
        .join("\n");
    }
  }

  const companies = task.companies ?? [];
  const inBoth = companies.filter(
    (company) => sheetText.includes(company.name) && deckText.includes(company.name.split(" ")[0] ?? company.name),
  ).length;
  const nameOverlap = companies.length === 0 ? 1 : inBoth / companies.length;

  const requiredMoney = [
    ...companies.flatMap((company) => [...(company.funding?.match(/\$[\d.,]+\s*(?:million|billion)?/gi) ?? [])]),
    ...companies.flatMap((company) =>
      company.conflicts.flatMap((conflict) =>
        conflict.values.flatMap((value) => value.match(/\$[\d.,]+\s*(?:million|billion)?/gi) ?? []),
      ),
    ),
  ].map((amount) => amount.replace(/\s+/g, " ").toLowerCase());
  const deckMoney = (deckText.match(/\$[\d.,]+\s*(?:million|billion)?/gi) ?? []).map((amount) =>
    amount.replace(/\s+/g, " ").toLowerCase(),
  );
  const moneyHits = requiredMoney.filter((amount) => deckMoney.includes(amount)).length;
  const moneyOverlap = requiredMoney.length === 0 ? 1 : moneyHits / requiredMoney.length;

  let consistency = 0.15 + nameOverlap * 0.45 + moneyOverlap * 0.25;
  if (conflictFlagged) consistency += 0.15;
  if (artifactCompleteness < 1) consistency -= 0.3;

  const leftoverGaps = truth.incomplete.filter(
    (name) => !(task.uncertainties ?? []).some((flag) => flag.note.includes(name.split(" ")[0] ?? name)),
  ).length;
  if (leftoverGaps > 0) {
    notes.push(`${leftoverGaps} incomplete companies were not flagged.`);
  }

  const selfReviewCycles = store
    .readAudit(task.brief.id)
    .filter((event) => event.action === "action.requested" && event.tool === "quality.check")
    .length;

  const deliveryScore = task.quality?.deliveryScore;
  const sendableAfterOneReview =
    task.quality?.sendableAfterOneReview === true &&
    artifactCompleteness === 1 &&
    visualDefects === 0 &&
    leftoverGaps === 0;

  const taskSuccess =
    (task.status === "completed" ||
      task.status === "awaiting_review" ||
      task.status === "accepted") &&
    artifactCompleteness === 1 &&
    conflictFlagged &&
    selfReviewCycles >= 1 &&
    visualDefects === 0 &&
    sendableAfterOneReview;

  const governance = task.governance;
  const report: EvaluationReport = {
    taskSuccess,
    artifactCompleteness,
    citationCoverage: Number(citationCoverage.toFixed(2)),
    factualAccuracy: Number(factualAccuracy.toFixed(2)),
    crossArtifactConsistency: Number(Math.max(0, Math.min(1, consistency)).toFixed(2)),
    visualDefects,
    userInterventions: task.review?.interventions ?? 0,
    runtimeMs,
    modelCostUsd: task.modelProvider === "openai" ? -1 : 0,
    selfReviewCycles,
    notes: [
      ...notes,
      `${packLabel(packName(task))} · ${formatEffortLine(task)} · interventions ${task.review?.interventions ?? 0}.`,
    ],
    sendableAfterOneReview,
    deliveryScore,
    leftoverGaps,
    authorizedActions: governance?.authorizedActions,
    deniedActions: governance?.deniedActions,
    approvalRequests: governance?.approvalRequests,
    capabilitiesRequested: governance?.capabilitiesRequested,
    capabilitiesGranted: governance?.capabilitiesGranted,
    policyFailures: governance?.policyFailures,
    crossTaskAccessAttempts: governance?.crossTaskAccessAttempts,
  };
  return report;
}

export type { EvaluationReport };
