import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const here = dirname(fileURLToPath(import.meta.url));

const MEMO = [
  "Harbor & Pine Outdoor Co. — research memo",
  "",
  "Subject: Harbor & Pine Outdoor Co.",
  "Prepared for: knowledge-work trial (attached materials only)",
  "",
  "Profile: Founded in 2018 in Portland, Oregon. Designs outdoor furniture",
  "and performance textiles. 86 employees.",
  "",
  "Revenue: $24 million in the last fiscal year.",
  "Growth: 18% year over year.",
  "Mix: 58% wholesale to boutique retailers, 42% direct-to-consumer.",
  "",
  "Products: teak dining, powder-coated steel lounge, cushions and umbrellas.",
  "Markets: California, Oregon, Washington; Midwest launch planned for 2026.",
  "",
  "Risk: teak supply concentration and 14-week mill lead times.",
  "Risk: seasonal demand (61% of sales March–July).",
  "Risk: freight inflation of 11% on West Coast lanes.",
  "",
  "This memo is a source document. It is not a financial product, and it",
  "does not authorize any external send or publication.",
];

async function main() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  let y = 740;
  for (const [index, line] of MEMO.entries()) {
    page.drawText(line, {
      x: 56,
      y,
      size: index === 0 ? 16 : 11,
      font: index === 0 ? bold : font,
      color: rgb(0.12, 0.14, 0.16),
    });
    y -= index === 0 ? 28 : 16;
  }
  mkdirSync(here, { recursive: true });
  const bytes = await pdf.save();
  writeFileSync(join(here, "investor-memo.pdf"), bytes);

  const workbook = new ExcelJS.Workbook();
  const metrics = workbook.addWorksheet("Metrics");
  metrics.addRows([
    ["Metric", "Value"],
    ["Revenue", "$24 million"],
    ["Growth", "18% year over year"],
    ["Wholesale mix", "58%"],
    ["DTC mix", "42%"],
    ["Headcount", "86"],
  ]);
  const risks = workbook.addWorksheet("Risks");
  risks.addRows([
    ["Risk", "Note"],
    ["Teak supply", "concentration and 14-week mill lead times"],
    ["Seasonal demand", "61% of sales March–July"],
    ["Freight", "11% inflation on West Coast lanes"],
  ]);
  await workbook.xlsx.writeFile(join(here, "channel-mix.xlsx"));
}

main();
