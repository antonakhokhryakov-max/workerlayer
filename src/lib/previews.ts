import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ArtifactRecord } from "@aether/contracts";
import type { TaskStore } from "@aether/runtime";

export interface SlidePreview {
  title: string;
  bullets: string[];
}

export function loadTaskPreviews(store: TaskStore, taskId: string, artifacts: ArtifactRecord[]) {
  const root = store.workspaceRoot(taskId);
  const document = artifacts.find((item) => item.kind === "document");
  const presentation = artifacts.find((item) => item.kind === "presentation");

  let markdown: string | undefined;
  if (document) {
    const abs = join(root, document.relativePath);
    if (existsSync(abs)) markdown = readFileSync(abs, "utf8");
  }

  let slides: { title?: string; slides: SlidePreview[] } | undefined;
  if (presentation) {
    const sidecar = join(root, presentation.relativePath.replace(/\.pptx$/i, ".slides.json"));
    if (existsSync(sidecar)) {
      slides = JSON.parse(readFileSync(sidecar, "utf8")) as {
        title?: string;
        slides: SlidePreview[];
      };
    }
  }

  return { markdown, slides };
}
