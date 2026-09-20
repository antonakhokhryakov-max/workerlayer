import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  BENCHMARK_GOAL,
  LAKESHORE_MOSSLINE_URL,
  MARKET_COMPANIES,
  MOSSLINE_APPROVED_CUSTOMERS,
} from "./companies";

const here = dirname(fileURLToPath(import.meta.url));

async function writePdf(name: string, lines: string[]) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  let y = 740;
  for (const [index, line] of lines.entries()) {
    if (y < 60) {
      page = pdf.addPage([612, 792]);
      y = 740;
    }
    page.drawText(line.slice(0, 96), {
      x: 56,
      y,
      size: index === 0 ? 14 : 11,
      font: index === 0 ? bold : font,
      color: rgb(0.12, 0.14, 0.16),
    });
    y -= index === 0 ? 24 : 15;
  }
  writeFileSync(join(here, name), await pdf.save());
}

async function main() {
  mkdirSync(here, { recursive: true });
  for (const company of MARKET_COMPANIES) {
    const lines = [
      `# ${company.name}`,
      "",
      `Company: ${company.name}`,
      `Headquarters: ${company.hq}`,
      `Business model: ${company.model}`,
      company.customers
        ? `Customers: ${company.customers}`
        : company.slug === "mossline-shelters"
          ? `Approved note: ${LAKESHORE_MOSSLINE_URL}`
          : "Customers: not stated in this profile",
      company.funding ? `Funding: ${company.funding}` : null,
      `Products: ${company.products}`,
      company.differentiators ? `Differentiators: ${company.differentiators}` : null,
      company.notes ? `Notes: ${company.notes}` : null,
      "",
      "This profile is synthetic source material for a knowledge-work assignment.",
    ].filter((line): line is string => line !== null);
    writeFileSync(join(here, `${company.slug}.md`), `${lines.join("\n")}\n`);
  }

  await writePdf("market-landscape.pdf", [
    "Lakeshore outdoor living — landscape memo",
    "",
    "Approved source for this assignment. Not an open-web scrape.",
    "",
    "The pack covers eighteen companies that sell outdoor living goods:",
    "furniture, shade, heat, cooking, textiles, and small structures.",
    "",
    "Common channels: specialty wholesale, direct-to-consumer, and project bid.",
    "Funding disclosure is uneven. Several profiles omit customers or differentiators.",
    "Mossline Shelters named customers are only on the approved note — not in this memo.",
    "",
    "Do not invent missing figures. Flag them. Do not use the open web.",
  ]);

  await writePdf("cedar-current-addendum.pdf", [
    "Cedar & Current — addendum",
    "",
    "# Cedar & Current",
    "Funding: $12 million Series B",
    "Products: Modular teak decks and rail planters",
    "",
    "This addendum disagrees with the company profile on funding.",
    "An honest knowledge worker must flag the conflict rather than pick a number.",
  ]);

  await writePdf("retailer-survey.pdf", [
    "Specialty retailer survey notes",
    "",
    "Buyers mention Harbor & Pine and Pebble & Dock most often for coastal sets.",
    "Shade replacements from Blue Heron Shade are described as easy to reorder.",
    "No respondent provided audited financials.",
    "Survey is qualitative and incomplete.",
  ]);

  await writePdf("category-notes.pdf", [
    "Category notes — outdoor living",
    "",
    "Clusters observed in the attached profiles:",
    "Seating and dining: Harbor & Pine, Pebble & Dock, Bramble Forge, Tidepool Rec.",
    "Heat and fire: Larkspur Fire Tables, Hearthlane Heaters, Redwood Ember Grills.",
    "Shelter and shade: Blue Heron Shade, Mossline Shelters, Silverpine Saunas.",
    "Textiles and tabletop: Saltwell Canvas, Ironvine Perennials, Gull & Grain.",
    "",
    "These notes do not add new company facts.",
  ]);

  const snapshot = new ExcelJS.Workbook();
  const funding = snapshot.addWorksheet("Funding");
  funding.addRow(["Company", "Funding"]);
  for (const company of MARKET_COMPANIES) {
    funding.addRow([company.name, company.funding ?? ""]);
  }
  await snapshot.xlsx.writeFile(join(here, "funding-snapshot.xlsx"));

  const groundTruth = {
    goal: BENCHMARK_GOAL,
    companies: MARKET_COMPANIES.map((company) => ({
      name: company.name,
      businessModel: company.model,
      customers:
        company.slug === "mossline-shelters"
          ? MOSSLINE_APPROVED_CUSTOMERS
          : company.customers ?? null,
      funding: company.funding ?? null,
      products: company.products,
      differentiators: company.differentiators ?? null,
    })),
    incomplete: MARKET_COMPANIES.filter(
      (company) => !company.customers || !company.funding || !company.differentiators,
    ).map((company) => company.name),
    conflicts: [
      {
        name: "Cedar & Current",
        field: "funding",
        values: ["$18 million Series B", "$12 million Series B"],
      },
    ],
    requiredArtifacts: ["spreadsheet", "presentation"],
    requestedSlides: 10,
  };
  writeFileSync(join(here, "ground-truth.json"), JSON.stringify(groundTruth, null, 2));
}

main();
