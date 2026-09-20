import type { ArtifactKind } from "@aether/contracts";

export function artifactPath(filename: string): string {
  const trimmed = filename.trim().replaceAll("\\", "/");
  return trimmed.startsWith("artifacts/") ? trimmed : `artifacts/${trimmed}`;
}

export function inferArtifactKind(path: string): ArtifactKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".csv")) return "spreadsheet";
  if (lower.endsWith(".pptx") || lower.endsWith(".slides.json")) return "presentation";
  if (lower.includes("/approved-web/") || lower.includes("/sandbox/")) return "file";
  if (lower.endsWith(".md") || lower.endsWith(".docx") || lower.endsWith(".html")) {
    return "document";
  }
  return "file";
}
