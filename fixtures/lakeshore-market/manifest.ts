import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MARKET_COMPANIES } from "./companies";

const here = dirname(fileURLToPath(import.meta.url));

export {
  BENCHMARK_GOAL,
  LAKESHORE_MOSSLINE_URL,
  MARKET_COMPANIES,
  MOSSLINE_APPROVED_CUSTOMERS,
} from "./companies";

export function benchmarkFiles(): Array<{ name: string; absolutePath: string }> {
  const names = [
    ...MARKET_COMPANIES.map((company) => `${company.slug}.md`),
    "market-landscape.pdf",
    "cedar-current-addendum.pdf",
    "retailer-survey.pdf",
    "category-notes.pdf",
    "funding-snapshot.xlsx",
  ];
  const files = names.map((name) => ({ name, absolutePath: join(here, name) }));
  for (const file of files) {
    if (!existsSync(file.absolutePath)) {
      throw new Error(`Missing benchmark file ${file.absolutePath}. Run pnpm fixtures.`);
    }
  }
  return files;
}

export function groundTruthPath(): string {
  return join(here, "ground-truth.json");
}

export function benchmarkFileCount(): number {
  return existsSync(here) ? readdirSync(here).length : 0;
}
