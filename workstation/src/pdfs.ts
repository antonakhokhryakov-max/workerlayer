import { extractText } from "unpdf";
import type { TaskWorkspace } from "./workspace";

const TABLE_HEADERS = /^(vendor|company|revenue|funding|lead time|customers|products)$/i;
const NAME_HEADERS = /^(vendor|company)$/i;

/** Rebuild a column-stacked PDF table into "name | value | value" rows. */
export function reconstructColumnarTable(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headers = lines
    .map((line, index) => ({ line, index }))
    .filter((item) => TABLE_HEADERS.test(item.line));
  if (headers.length < 2) return "";
  if (!headers.some((header) => NAME_HEADERS.test(header.line))) return "";
  const columns = headers.map((header, index) => {
    const start = header.index + 1;
    const end = index + 1 < headers.length ? headers[index + 1].index : lines.length;
    return [header.line, ...lines.slice(start, end)];
  });
  const width = Math.max(...columns.map((column) => column.length));
  if (width < 3) return "";
  const rows: string[] = [];
  for (let row = 0; row < width; row += 1) {
    rows.push(columns.map((column) => column[row] ?? "").join(" | "));
  }
  return rows.join("\n");
}

export function hasUsablePdfText(text: string): boolean {
  const cleaned = text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length >= 40 && /[A-Za-z]{3,}/.test(cleaned);
}

export function tidyExtractedText(text: string): string {
  const trimmed = text.replace(/\u0000/g, "").trim();
  const rebuilt = reconstructColumnarTable(trimmed);
  if (!rebuilt) return trimmed;
  return `${trimmed}\n\n${rebuilt}`;
}

export async function extractPdfText(
  workspace: TaskWorkspace,
  path: string,
): Promise<{ path: string; text: string; pages: number }> {
  const bytes = workspace.readBytes(path);
  const extracted = await extractText(new Uint8Array(bytes), { mergePages: true });
  const text = Array.isArray(extracted.text)
    ? extracted.text.join("\n")
    : extracted.text;
  return {
    path,
    text: tidyExtractedText(text),
    pages: extracted.totalPages ?? 1,
  };
}

export async function openPdf(
  workspace: TaskWorkspace,
  path: string,
): Promise<{
  path: string;
  opened: true;
  text: string;
  pages: number;
  excerpt: string;
  textLayer: boolean;
  needsOcr: boolean;
}> {
  const extracted = await extractPdfText(workspace, path);
  const textLayer = hasUsablePdfText(extracted.text);
  return {
    path: extracted.path,
    opened: true,
    text: extracted.text,
    pages: extracted.pages,
    excerpt: extracted.text.replace(/\s+/g, " ").trim().slice(0, 280),
    textLayer,
    needsOcr: !textLayer,
  };
}
