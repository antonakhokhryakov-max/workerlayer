import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const APPROVED_GOAL =
  "Research Fir Ridge Cooperage using the attached materials and any destination this assignment approved. Produce a spreadsheet and a short presentation. Cite sources and flag uncertainty. Do not use the open web.";

export const FIR_RIDGE_APPROVED_URL = "https://notes.fir-ridge.example/profile";

export function approvedFiles(): Array<{ name: string; absolutePath: string }> {
  const files = ["company-brief.md", "notes.txt"].map((name) => ({
    name,
    absolutePath: join(here, name),
  }));
  for (const file of files) {
    if (!existsSync(file.absolutePath)) {
      throw new Error(`Missing approved-web fixture ${file.absolutePath}.`);
    }
  }
  return files;
}
