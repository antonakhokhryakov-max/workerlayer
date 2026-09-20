import { artifactPath } from "./artifacts";
import type { TaskWorkspace } from "./workspace";

export function createDocument(
  workspace: TaskWorkspace,
  filename: string,
  title: string,
  markdown: string,
): { path: string; kind: "document"; title: string; bytes: number } {
  const relativePath = artifactPath(
    filename.endsWith(".md") ? filename : `${filename}.md`,
  );
  const body = markdown.trim().length > 0 ? markdown : `# ${title}\n\n(empty)\n`;
  workspace.writeBytes(relativePath, body);
  return {
    path: relativePath,
    kind: "document",
    title,
    bytes: Buffer.byteLength(body),
  };
}
