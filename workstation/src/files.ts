import type { TaskWorkspace } from "./workspace";

export function readWorkspaceFile(workspace: TaskWorkspace, path: string) {
  const bytes = workspace.readBytes(path);
  const text = looksText(path, bytes) ? bytes.toString("utf8") : undefined;
  return {
    path,
    bytes: bytes.length,
    encoding: text ? "utf8" : "binary",
    content: text,
  };
}

function looksText(path: string, bytes: Buffer): boolean {
  const lower = path.toLowerCase();
  if (/\.(txt|md|csv|json|tsv|html|xml|log)$/.test(lower)) return true;
  const sample = bytes.subarray(0, 800);
  return !sample.includes(0);
}
