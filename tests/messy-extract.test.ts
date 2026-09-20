import { describe, expect, it } from "vitest";
import { extractCompanies } from "@aether/agent";
import { reconstructColumnarTable, tidyExtractedText } from "@aether/workstation";

describe("messy source extraction", () => {
  it("rebuilds a column-stacked PDF table into readable rows", () => {
    const stacked = [
      "Vendor",
      "Ironwharf Canvas",
      "Splitrock Hardware",
      "Revenue",
      "$4.8 million",
      "$1.6 million",
      "Lead time",
      "6 weeks",
      "3 weeks",
    ].join("\n");
    const rebuilt = reconstructColumnarTable(stacked);
    expect(rebuilt).toMatch(/Ironwharf Canvas \| \$4\.8 million \| 6 weeks/);
    expect(tidyExtractedText(stacked)).toContain("Ironwharf Canvas | $4.8 million | 6 weeks");
  });

  it("pulls overlapping-memo money onto known vendors and flags a real conflict", () => {
    const companies = extractCompanies([
      {
        path: "sources/ironwharf-canvas.md",
        text: "# Ironwharf Canvas\n\nFunding: $4.8 million seed\nProducts: Dodgers",
      },
      {
        path: "sources/splitrock-hardware.md",
        text: "# Splitrock Hardware\n\nFunding: $1.6 million owner-funded\nProducts: clips",
      },
      {
        path: "sources/capacity-table.pdf",
        text: [
          "Vendor",
          "Ironwharf Canvas",
          "Splitrock Hardware",
          "Revenue",
          "$4.8 million",
          "$1.6 million",
        ].join("\n"),
      },
      {
        path: "sources/overlapping-memo.pdf",
        text: [
          "We walked Ironwharf Canvas and Splitrock Hardware the same afternoon.",
          "Ironwharf Canvas funding was recorded here as $3.1 million seed.",
          "Splitrock Hardware funding in this memo is $2.0 million owner-funded.",
        ].join("\n"),
      },
    ]);

    const ironwharf = companies.find((company) => company.name === "Ironwharf Canvas");
    const splitrock = companies.find((company) => company.name === "Splitrock Hardware");
    expect(ironwharf?.conflicts.some((item) => item.values.some((value) => /3\.1/.test(value)))).toBe(true);
    expect(splitrock?.conflicts.some((item) => item.values.some((value) => /2\.0/.test(value)))).toBe(true);
    expect(companies.map((company) => company.name).sort()).toEqual([
      "Ironwharf Canvas",
      "Splitrock Hardware",
    ]);
  });

  it("does not invent a company from a spreadsheet sheet title or a header-only stack", () => {
    const companies = extractCompanies([
      {
        path: "sources/capacity-snapshot.xlsx",
        text: "# Capacity\nIronwharf Canvas | Revenue | $4.8 million\nSplitrock Hardware | Revenue | $1.6 million",
      },
      {
        path: "sources/ironwharf-canvas.md",
        text: "# Ironwharf Canvas\n\nFunding: $4.8 million seed\nProducts: Dodgers",
      },
    ]);
    expect(companies.map((company) => company.name)).toEqual(["Ironwharf Canvas"]);
    expect(reconstructColumnarTable(["Revenue", "$24 million", "Products", "teak dining"].join("\n"))).toBe(
      "",
    );
  });

  it("does not invent a second Harbor funding figure from a nearby or wrapped line", () => {
    const companies = extractCompanies([
      {
        path: "sources/company-brief.md",
        text: "# Harbor & Pine Outdoor Co.\n\nIndustry: Outdoor furniture\nCustomers: shops\nProducts: teak dining",
      },
      {
        path: "sources/investor-memo.pdf",
        text: [
          "Harbor & Pine Outdoor Co. — research memo",
          "Subject: Harbor & Pine Outdoor Co.",
          "Revenue: $24 million in the last fiscal year.",
          "Products: teak dining, powder-coated steel lounge, cushions and umbrellas.",
        ].join("\n"),
      },
    ]);
    expect(companies).toHaveLength(1);
    expect(companies[0]?.funding).toMatch(/24 million/);
    expect(companies[0]?.conflicts).toEqual([]);
  });
});
