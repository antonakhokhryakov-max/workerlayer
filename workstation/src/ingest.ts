import { extractPdfText } from "./pdfs";
import { readWorkspaceFile } from "./files";
import { openSpreadsheet } from "./spreadsheets";
import type { TaskWorkspace } from "./workspace";

export async function ingestAttachedSources(workspace: TaskWorkspace) {
  const files = workspace
    .listFiles()
    .filter((file) => file.path.startsWith("sources/") && !file.path.includes("/."));
  const sources: Array<{ path: string; text: string; bytes: number }> = [];
  for (const file of files) {
    const lower = file.path.toLowerCase();
    if (lower.endsWith(".pdf")) {
      const extracted = await extractPdfText(workspace, file.path);
      sources.push({ path: file.path, text: extracted.text, bytes: file.bytes });
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const opened = await openSpreadsheet(workspace, file.path);
      sources.push({ path: file.path, text: opened.text, bytes: file.bytes });
    } else {
      const read = readWorkspaceFile(workspace, file.path);
      sources.push({
        path: file.path,
        text: read.content ?? "",
        bytes: file.bytes,
      });
    }
  }
  return { sources };
}
