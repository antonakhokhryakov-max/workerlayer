import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { TaskStore } from "@aether/runtime";

export function tempStore(): TaskStore {
  const root = mkdtempSync(join(tmpdir(), "aether-"));
  return new TaskStore(root);
}

export async function writeResearchPack(workspaceRoot: string): Promise<void> {
  const sources = join(workspaceRoot, "sources");
  mkdirSync(sources, { recursive: true });
  writeFileSync(
    join(sources, "company-brief.md"),
    [
      "# Northwind Lantern Co.",
      "",
      "Company: Northwind Lantern Co.",
      "Founded: 2014",
      "Headquarters: Burlington, Vermont",
      "Industry: Outdoor lighting",
      "Headcount: 41",
      "Products: oil lanterns, rechargeable camp lights, glass shades",
      "Markets: New England specialty retailers and a small online shop",
    ].join("\n"),
  );
  writeFileSync(
    join(sources, "notes.txt"),
    [
      "Risk: glass shade breakage in winter freight.",
      "Growth: 9% year over year, mostly from rechargeable lights.",
      "Customers: independent outfitters; two regional parks accounts.",
    ].join("\n"),
  );

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  page.drawText("Northwind Lantern Co. memo", { x: 56, y: 720, size: 16, font });
  page.drawText("Revenue: $6.4 million last year.", { x: 56, y: 690, size: 12, font });
  page.drawText("Risk: battery cell supply is single-sourced.", { x: 56, y: 670, size: 12, font });
  writeFileSync(join(sources, "memo.pdf"), await pdf.save());

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Metrics");
  sheet.addRows([
    ["Metric", "Value"],
    ["Revenue", "$6.4 million"],
    ["Growth", "9% year over year"],
  ]);
  await workbook.xlsx.writeFile(join(sources, "metrics.xlsx"));
}

export async function writeTwoCompanyPack(workspaceRoot: string): Promise<void> {
  const sources = join(workspaceRoot, "sources");
  mkdirSync(sources, { recursive: true });
  writeFileSync(
    join(sources, "northwind.md"),
    [
      "# Northwind Lantern Co.",
      "",
      "Company: Northwind Lantern Co.",
      "Business model: specialty outdoor lighting sold through retailers",
      "Customers: New England outfitters and two regional parks",
      "Funding: $6.4 million last-year revenue, no outside round disclosed",
      "Products: oil lanterns, rechargeable camp lights, glass shades",
      "Differentiators: glasswork made in Vermont",
    ].join("\n"),
  );
  writeFileSync(
    join(sources, "saltwell.md"),
    [
      "# Saltwell Canvas",
      "",
      "Company: Saltwell Canvas",
      "Business model: made-to-order outdoor canvas and shade",
      "Customers: coastal hotels and boat yards",
      "Funding: $2.1 million seed",
      "Products: sails, awnings, custom shade structures",
      "Differentiators: marine-grade stitch work",
    ].join("\n"),
  );

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  page.drawText("Two-company research addendum", { x: 56, y: 720, size: 16, font });
  page.drawText("Northwind Lantern Co. revenue: $6.4 million.", { x: 56, y: 690, size: 12, font });
  page.drawText("Saltwell Canvas seed: $2.1 million.", { x: 56, y: 670, size: 12, font });
  writeFileSync(join(sources, "addendum.pdf"), await pdf.save());
}
