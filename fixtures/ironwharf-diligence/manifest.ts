import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DILIGENCE_GOAL,
  DILIGENCE_VENDORS,
  SCAN_ONLY_HOLD,
  SCAN_ONLY_HOLD_LABEL,
  SCAN_ONLY_INVOICE,
  SCAN_ONLY_INVOICE_LABEL,
} from "./companies";

const here = dirname(fileURLToPath(import.meta.url));

export {
  DILIGENCE_GOAL,
  DILIGENCE_VENDORS,
  SCAN_ONLY_HOLD,
  SCAN_ONLY_HOLD_LABEL,
  SCAN_ONLY_INVOICE,
  SCAN_ONLY_INVOICE_LABEL,
};

export function diligenceFiles(): Array<{ name: string; absolutePath: string }> {
  const names = [
    ...DILIGENCE_VENDORS.map((vendor) => `${vendor.slug}.md`),
    "vendor-survey.pdf",
    "mill-audit.pdf",
    "capacity-table.pdf",
    "overlapping-memo.pdf",
    "shop-floor-scan.pdf",
    "mill-invoice-scan.pdf",
    "bonded-hold-scan.pdf",
    "capacity-snapshot.xlsx",
  ];
  const files = names.map((name) => ({ name, absolutePath: join(here, name) }));
  for (const file of files) {
    if (!existsSync(file.absolutePath)) {
      throw new Error(`Missing diligence file ${file.absolutePath}. Run pnpm fixtures.`);
    }
  }
  return files;
}
