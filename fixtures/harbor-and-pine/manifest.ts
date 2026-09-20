import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const SAMPLE_GOAL =
  "Research this company using the attached materials. Analyze the information, produce a supporting spreadsheet and prepare a short presentation summarizing the most important findings. Cite sources and flag uncertainty.";

export function sampleFiles(): Array<{ name: string; absolutePath: string }> {
  const files = [
    "company-brief.md",
    "operating-notes.txt",
    "investor-memo.pdf",
    "channel-mix.xlsx",
  ].map((name) => ({ name, absolutePath: join(here, name) }));
  for (const file of files) {
    if (!existsSync(file.absolutePath)) {
      throw new Error(`Missing sample file ${file.absolutePath}. Run pnpm fixtures.`);
    }
  }
  return files;
}
