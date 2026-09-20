import type { QualityIssue, QualityReport, RecordedAnalysis } from "@aether/contracts";
import { inferArtifactKind } from "./artifacts";
import { readSpreadsheetSummary } from "./spreadsheets";
import type { TaskWorkspace } from "./workspace";

function canonicalMoney(raw: string): string {
  const amount = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return raw.replace(/\s+/g, " ").toLowerCase();
  if (/billion|[0-9.]b\b|\bb\b/i.test(raw) && !/million/i.test(raw)) return `$${amount} billion`;
  if (/million|[0-9.]m\b|\bm\b/i.test(raw)) return `$${amount} million`;
  return `$${amount}`;
}

function moneyMentions(text: string): string[] {
  return unique(
    [...text.matchAll(/\$[\d.,]+\s*(?:million|billion|[mb])?\b/gi)].map((match) =>
      canonicalMoney(match[0]),
    ),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function deliveryFromIssues(issues: QualityIssue[]): {
  deliveryScore: number;
  sendableAfterOneReview: boolean;
} {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const deliveryScore = Math.max(0, Number((1 - errors * 0.18 - warnings * 0.06).toFixed(2)));
  return {
    deliveryScore,
    sendableAfterOneReview: errors === 0 && deliveryScore >= 0.8,
  };
}

function gridText(workspace: TaskWorkspace, spreadsheetPath: string): string {
  const sidecar = spreadsheetPath.replace(/\.xlsx$/i, ".grid.json");
  if (!workspace.exists(sidecar)) return "";
  const parsed = JSON.parse(workspace.readBytes(sidecar).toString("utf8")) as {
    sheets?: Array<{ name?: string; rows?: Array<Array<string | number | null>> }>;
  };
  return (parsed.sheets ?? [])
    .flatMap((sheet) => [
      sheet.name ?? "",
      ...(sheet.rows ?? []).map((row) => row.map((cell) => String(cell ?? "")).join(" ")),
    ])
    .join("\n");
}

function slideText(workspace: TaskWorkspace, presentationPath: string): string {
  const sidecar = presentationPath.replace(/\.pptx$/i, ".slides.json");
  if (!workspace.exists(sidecar)) return "";
  const parsed = JSON.parse(workspace.readBytes(sidecar).toString("utf8")) as {
    slides?: Array<{ title?: string; bullets?: string[] }>;
  };
  return (parsed.slides ?? [])
    .flatMap((slide) => [slide.title ?? "", ...(slide.bullets ?? [])])
    .join("\n");
}

export async function inspectArtifacts(workspace: TaskWorkspace) {
  const files = workspace.listFiles().filter((file) => file.path.startsWith("artifacts/"));
  const artifacts = [];
  for (const file of files) {
    const kind = inferArtifactKind(file.path);
    if (kind === "spreadsheet") {
      const summary = await readSpreadsheetSummary(workspace, file.path);
      artifacts.push({
        path: file.path,
        kind,
        sheets: summary.sheets.map((sheet) => sheet.name),
        rowCounts: Object.fromEntries(
          summary.sheets.map((sheet) => [sheet.name, sheet.rowCount]),
        ),
        text: gridText(workspace, file.path),
      });
    } else if (kind === "presentation") {
      const sidecar = file.path.replace(/\.pptx$/i, ".slides.json");
      if (!workspace.exists(sidecar)) continue;
      const parsed = JSON.parse(workspace.readBytes(sidecar).toString("utf8")) as {
        slides?: Array<{ title?: string; bullets?: string[] }>;
      };
      const slides = parsed.slides ?? [];
      artifacts.push({
        path: file.path,
        kind,
        slideCount: slides.length,
        titles: slides.map((slide) => slide.title ?? ""),
        emptySlides: slides.filter((slide) => (slide.bullets ?? []).length === 0).length,
        text: slideText(workspace, file.path),
      });
    } else if (kind === "document" && file.path.endsWith(".md")) {
      const text = workspace.readBytes(file.path).toString("utf8");
      artifacts.push({
        path: file.path,
        kind,
        chars: text.length,
        hasSources: /source/i.test(text),
        hasUncertainty: /uncertain/i.test(text),
        text,
      });
    }
  }
  return { artifacts };
}

export async function checkQuality(
  workspace: TaskWorkspace,
  requestedSlides?: number,
): Promise<QualityReport> {
  const issues: QualityIssue[] = [];
  const inspected: string[] = [];
  const inspection = await inspectArtifacts(workspace);

  let analysis: RecordedAnalysis | undefined;
  if (workspace.exists("findings.json")) {
    analysis = JSON.parse(workspace.readBytes("findings.json").toString("utf8")) as RecordedAnalysis;
  }

  const spreadsheet = inspection.artifacts.find((item) => item.kind === "spreadsheet");
  const presentation = inspection.artifacts.find((item) => item.kind === "presentation");
  const document = inspection.artifacts.find((item) => item.kind === "document");

  if (spreadsheet) {
    inspected.push(String(spreadsheet.path));
    const sheets = (spreadsheet.sheets as string[]) ?? [];
    if (!sheets.some((name) => name.toLowerCase() === "uncertainty")) {
      issues.push({
        code: "spreadsheet.missing_uncertainty",
        severity: "error",
        artifact: "spreadsheet",
        message: "Spreadsheet is missing an Uncertainty sheet.",
      });
    }
    if (!sheets.some((name) => name.toLowerCase() === "sources")) {
      issues.push({
        code: "spreadsheet.missing_sources",
        severity: "error",
        artifact: "spreadsheet",
        message: "Spreadsheet is missing a Sources sheet.",
      });
    }
    if ((analysis?.companies?.length ?? 0) >= 2) {
      if (!sheets.some((name) => name.toLowerCase() === "comparison")) {
        issues.push({
          code: "spreadsheet.missing_comparison",
          severity: "error",
          artifact: "spreadsheet",
          message: "Multi-company work is missing a Comparison sheet.",
        });
      }
    }
  } else {
    issues.push({
      code: "spreadsheet.missing",
      severity: "error",
      artifact: "spreadsheet",
      message: "No spreadsheet artifact to inspect.",
    });
  }

  if (presentation) {
    inspected.push(String(presentation.path));
    const slideCount = Number(presentation.slideCount ?? 0);
    const titles = ((presentation.titles as string[]) ?? []).join(" ");
    if ((presentation.emptySlides as number) > 0) {
      issues.push({
        code: "presentation.empty_slide",
        severity: "error",
        artifact: "presentation",
        message: "A slide has no bullets — likely a rendering defect.",
      });
    }
    if (requestedSlides && slideCount < requestedSlides - 1) {
      issues.push({
        code: "presentation.slide_count",
        severity: "error",
        artifact: "presentation",
        message: `Assignment asked for about ${requestedSlides} slides; the deck has ${slideCount}.`,
      });
    }
    if (!/source|citation/i.test(titles)) {
      issues.push({
        code: "presentation.missing_sources",
        severity: "error",
        artifact: "presentation",
        message: "Deck is missing a sources/citations slide.",
      });
    }
    if (!/uncertain|gap|conflict/i.test(titles)) {
      issues.push({
        code: "presentation.missing_uncertainty",
        severity: "error",
        artifact: "presentation",
        message: "Deck does not flag uncertainty or conflicts.",
      });
    }
  } else {
    issues.push({
      code: "presentation.missing",
      severity: "error",
      artifact: "presentation",
      message: "No presentation artifact to inspect.",
    });
  }

  if (document) {
    inspected.push(String(document.path));
    if (!document.hasSources) {
      issues.push({
        code: "document.missing_sources",
        severity: "warning",
        artifact: "document",
        message: "Written summary does not cite sources.",
      });
    }
  }

  const conflicts = analysis?.companies?.flatMap((company) =>
    company.conflicts.map((conflict) => `${company.name} ${conflict.field}`),
  ) ?? [];
  if (conflicts.length > 0) {
    const flagged = (analysis?.uncertainties ?? []).some((flag) =>
      /conflict|inconsist|disagree|does not match/i.test(flag.note),
    );
    if (!flagged) {
      issues.push({
        code: "analysis.unflagged_conflict",
        severity: "error",
        artifact: "analysis",
        message: `Source conflict was not flagged: ${conflicts.join("; ")}.`,
      });
    }
  }

  const companyNames = analysis?.companies?.map((company) => company.name) ?? [];
  const sheetText = String(spreadsheet?.text ?? "");
  const deckText = String(presentation?.text ?? "");
  const summaryText = String(document?.text ?? "");
  const combinedOutputs = `${sheetText}\n${deckText}\n${summaryText}`;

  if (companyNames.length >= 2 && presentation) {
    const missingFromDeck = companyNames.filter((name) => {
      const token = name.split(" ")[0] ?? name;
      return !deckText.includes(name) && !deckText.includes(token);
    });
    if (missingFromDeck.length > 0) {
      issues.push({
        code: "consistency.companies_not_in_deck",
        severity: missingFromDeck.length >= Math.ceil(companyNames.length / 2) ? "error" : "warning",
        artifact: "presentation",
        message: `Deck is missing companies from the comparison: ${missingFromDeck.slice(0, 4).join(", ")}.`,
      });
    }
  }

  if (companyNames.length >= 2 && spreadsheet) {
    const missingFromSheet = companyNames.filter((name) => !sheetText.includes(name));
    if (missingFromSheet.length > 0) {
      issues.push({
        code: "consistency.companies_not_in_spreadsheet",
        severity: "error",
        artifact: "spreadsheet",
        message: `Spreadsheet comparison is missing ${missingFromSheet.slice(0, 4).join(", ")}.`,
      });
    }
  }

  const requiredMoney = unique([
    ...(analysis?.companies ?? []).flatMap((company) => [
      ...moneyMentions(company.funding ?? ""),
      ...company.conflicts.flatMap((conflict) => conflict.values.flatMap((value) => moneyMentions(value))),
    ]),
    ...(analysis?.findings ?? [])
      .filter((finding) => finding.category === "Metric")
      .flatMap((finding) => moneyMentions(`${finding.finding} ${finding.evidence}`)),
  ]);
  const deckMoney = moneyMentions(deckText);
  if (requiredMoney.length > 0 && presentation) {
    const missingMoney = requiredMoney.filter((amount) => !deckMoney.includes(amount));
    if (missingMoney.length > 0) {
      issues.push({
        code: "consistency.numbers_not_in_deck",
        severity: "error",
        artifact: "presentation",
        message: `Spreadsheet figures are missing from the deck: ${missingMoney.slice(0, 4).join(", ")}.`,
      });
    }
  }

  for (const company of analysis?.companies ?? []) {
    for (const conflict of company.conflicts) {
      const mentioned = conflict.values.every((value) =>
        combinedOutputs.toLowerCase().includes(value.toLowerCase().slice(0, 12)),
      );
      if (!mentioned) {
        issues.push({
          code: "consistency.conflict_not_cross_checked",
          severity: "error",
          artifact: "presentation",
          message: `${company.name} ${conflict.field} conflict is not shown in both artifacts.`,
        });
      }
    }
    if (company.missing.length > 0) {
      const flagged = (analysis?.uncertainties ?? []).some((flag) =>
        flag.note.includes(company.name.split(" ")[0] ?? company.name),
      );
      if (!flagged) {
        issues.push({
          code: "consistency.leftover_gap",
          severity: "warning",
          artifact: "analysis",
          message: `${company.name} still has unflagged gaps: ${company.missing.join(", ")}.`,
        });
      }
    }
  }

  const invoiceMetrics = (analysis?.findings ?? []).filter(
    (finding) => /invoice/i.test(finding.finding) && /\$/.test(`${finding.finding} ${finding.evidence}`),
  );
  const holdMetrics = (analysis?.findings ?? []).filter(
    (finding) => /warehouse hold|bonded hold/i.test(finding.finding) && /\$/.test(`${finding.finding} ${finding.evidence}`),
  );
  const unreadScanAmount = (analysis?.uncertainties ?? []).some((flag) =>
    /did not recover a readable amount/i.test(flag.note),
  );
  const invoiceScanMentioned = (analysis?.uncertainties ?? []).some((flag) =>
    /invoice/i.test(flag.note) && /ocr|scan|image-only/i.test(flag.note),
  );
  const holdScanMentioned = (analysis?.uncertainties ?? []).some((flag) =>
    /hold/i.test(flag.note) && /ocr|scan|image-only/i.test(flag.note),
  );
  if (invoiceScanMentioned && invoiceMetrics.length === 0 && !unreadScanAmount) {
    issues.push({
      code: "ocr.unread_scan_figure",
      severity: "warning",
      artifact: "analysis",
      message: "An image-only invoice scan was read, but no amount was recovered and the gap was not flagged.",
    });
  }
  if (holdScanMentioned && holdMetrics.length === 0 && !unreadScanAmount) {
    issues.push({
      code: "ocr.unread_scan_figure",
      severity: "warning",
      artifact: "analysis",
      message: "An image-only warehouse-hold scan was read, but no amount was recovered and the gap was not flagged.",
    });
  }

  const delivery = deliveryFromIssues(issues);
  const hasUncertaintySheet =
    ((spreadsheet?.sheets as string[]) ?? []).some((name) => name.toLowerCase() === "uncertainty");
  const pass = delivery.sendableAfterOneReview
    ? "final"
    : hasUncertaintySheet
      ? "corrected"
      : "draft";

  return {
    ok: issues.filter((issue) => issue.severity === "error").length === 0,
    issues,
    inspected,
    pass,
    ...delivery,
  };
}
