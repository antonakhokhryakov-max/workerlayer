import { mkdirSync } from "node:fs";
import { join } from "node:path";

export function dataRoot(override?: string): string {
  const root = override ?? process.env.AETHER_DATA_DIR ?? join(process.cwd(), "data");
  mkdirSync(root, { recursive: true });
  return root;
}

export function taskDir(taskId: string, root?: string): string {
  const dir = join(dataRoot(root), "tasks", taskId);
  mkdirSync(dir, { recursive: true });
  return dir;
}
