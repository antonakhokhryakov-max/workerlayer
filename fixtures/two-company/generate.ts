import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  page.drawText("Two-company research addendum", { x: 56, y: 720, size: 16, font: bold });
  page.drawText("Northwind Lantern Co. revenue: $6.4 million.", { x: 56, y: 690, size: 12, font });
  page.drawText("Saltwell Canvas seed: $2.1 million.", { x: 56, y: 670, size: 12, font });
  page.drawText("Figures are from attached materials only.", { x: 56, y: 650, size: 12, font });
  writeFileSync(join(here, "addendum.pdf"), await pdf.save());
}

main();
