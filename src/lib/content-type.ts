export function downloadContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export function downloadLabel(kind: string): string {
  if (kind === "presentation") return "Download slides";
  if (kind === "document") return "Download summary";
  if (kind === "spreadsheet") return "Download workbook";
  return "Download";
}
