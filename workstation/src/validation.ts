import type { ArtifactKind } from "@aether/contracts";
import { inferArtifactKind } from "./artifacts";
import { readSpreadsheetSummary } from "./spreadsheets";
import type { TaskWorkspace } from "./workspace";

export async function validateArtifact(
  workspace: TaskWorkspace,
  relativePath: string,
  kind?: ArtifactKind,
): Promise<{ valid: boolean; notes: string[]; kind: ArtifactKind; path: string }> {
  const resolvedKind = kind && kind !== "file" ? kind : inferArtifactKind(relativePath);
  if (!workspace.exists(relativePath)) {
    return {
      valid: false,
      notes: [`Missing artifact ${relativePath}`],
      kind: resolvedKind,
      path: relativePath,
    };
  }

  if (resolvedKind === "spreadsheet") {
    return { ...(await validateSpreadsheetArtifact(workspace, relativePath)), kind: resolvedKind, path: relativePath };
  }
  if (resolvedKind === "presentation") {
    return { ...validatePresentationArtifact(workspace, relativePath), kind: resolvedKind, path: relativePath };
  }
  if (resolvedKind === "document") {
    return { ...validateDocumentArtifact(workspace, relativePath), kind: resolvedKind, path: relativePath };
  }
  return { valid: true, notes: [], kind: resolvedKind, path: relativePath };
}

export async function validateSpreadsheetArtifact(
  workspace: TaskWorkspace,
  relativePath: string,
): Promise<{ valid: boolean; notes: string[] }> {
  const notes: string[] = [];
  const summary = await readSpreadsheetSummary(workspace, relativePath);
  if (summary.sheets.length === 0) {
    notes.push("Workbook has no sheets.");
  }

  const findings = summary.sheets.find(
    (sheet) => sheet.name.toLowerCase() === "findings",
  );
  if (!findings) {
    notes.push("Expected a Findings sheet.");
  } else if (findings.rowCount < 2) {
    notes.push("Findings sheet has no data rows.");
  }

  const summarySheet = summary.sheets.find(
    (sheet) => sheet.name.toLowerCase() === "summary",
  );
  if (!summarySheet) {
    notes.push("Expected a Summary sheet.");
  }

  const sources = summary.sheets.find((sheet) => sheet.name.toLowerCase() === "sources");
  if (!sources) {
    notes.push("Expected a Sources sheet for citations.");
  }

  return { valid: notes.length === 0, notes };
}

function validatePresentationArtifact(
  workspace: TaskWorkspace,
  relativePath: string,
): { valid: boolean; notes: string[] } {
  const notes: string[] = [];
  const sidecar = relativePath.replace(/\.pptx$/i, ".slides.json");
  if (!workspace.exists(sidecar)) {
    notes.push("Missing slides.json sidecar used to inspect the deck.");
    return { valid: false, notes };
  }
  const raw = workspace.readBytes(sidecar).toString("utf8");
  const parsed = JSON.parse(raw) as { slides?: Array<{ title?: string; bullets?: string[] }> };
  const slides = parsed.slides ?? [];
  if (slides.length < 4) {
    notes.push("Presentation should have at least four slides.");
  }
  const titles = slides.map((slide) => (slide.title ?? "").toLowerCase()).join(" ");
  if (!/source|citation/.test(titles)) {
    notes.push("Expected a sources or citations slide.");
  }
  if (!/uncertain|gap/.test(titles)) {
    notes.push("Expected a slide that flags uncertainty.");
  }
  return { valid: notes.length === 0, notes };
}

function validateDocumentArtifact(
  workspace: TaskWorkspace,
  relativePath: string,
): { valid: boolean; notes: string[] } {
  const notes: string[] = [];
  const text = workspace.readBytes(relativePath).toString("utf8");
  if (text.trim().length < 400) {
    notes.push("Written summary is too short to be a one-page brief.");
  }
  if (!/source/i.test(text)) {
    notes.push("Expected a Sources section.");
  }
  if (!/uncertain/i.test(text)) {
    notes.push("Expected uncertainty to be flagged in the summary.");
  }
  return { valid: notes.length === 0, notes };
}
