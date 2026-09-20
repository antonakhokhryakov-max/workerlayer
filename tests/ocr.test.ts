import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alignOcrToKnownNames, extractCompanies, heuristicAnalysis } from "@aether/agent";
import { SCAN_ONLY_HOLD, SCAN_ONLY_INVOICE } from "../fixtures/ironwharf-diligence/companies";
import {
  commandAvailable,
  extractPdfText,
  hasUsablePdfText,
  ocrPdf,
  parseTesseractTsv,
  textFromOcrWords,
  TaskWorkspace,
} from "@aether/workstation";
import { tempStore } from "./helpers";

function ensureScanFixture() {
  const scan = join(process.cwd(), "fixtures/ironwharf-diligence/shop-floor-scan.pdf");
  if (!existsSync(scan)) {
    execSync("pnpm exec tsx fixtures/ironwharf-diligence/generate.ts", {
      cwd: process.cwd(),
      stdio: "pipe",
    });
  }
  return scan;
}

describe("image-only PDF OCR", () => {
  it("keeps the mill-invoice amount out of every text diligence source", () => {
    const dir = join(process.cwd(), "fixtures/ironwharf-diligence");
    const readable = readdirSync(dir).filter((name) => /\.(md|json|ts)$/.test(name) && name !== "companies.ts" && name !== "generate.ts" && name !== "manifest.ts");
    for (const name of readable) {
      expect(readFileSync(join(dir, name), "utf8"), name).not.toMatch(/410,000|410000|287,500|287500/);
    }
  });

  it("drops low-confidence number-like tokens instead of inventing them", () => {
    const parsed = textFromOcrWords(
      parseTesseractTsv(
        [
          "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
          "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t92\tSplitrock",
          "5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t91\tHardware",
          "5\t1\t1\t1\t1\t3\t0\t0\t10\t10\t41\t$2.9",
          "5\t1\t1\t1\t1\t4\t0\t0\t10\t10\t88\tmillion",
        ].join("\n"),
      ),
    );
    expect(parsed.text).toContain("Splitrock Hardware");
    expect(parsed.text).not.toContain("$2.9");
    expect(parsed.dropped.some((word) => word.text === "$2.9")).toBe(true);
  });

  it("aligns a one-letter OCR slip to a known vendor without inventing a number", () => {
    expect(alignOcrToKnownNames("lronwharf Canvas 11 staged dodgers", ["Ironwharf Canvas"])).toContain(
      "Ironwharf Canvas",
    );
  });

  it("recovers vendor rows from an image-only shop-floor scan", async () => {
    ensureScanFixture();
    if (!commandAvailable("tesseract") || !commandAvailable("pdftoppm")) {
      throw new Error("tesseract and pdftoppm are required for the scan fixture test.");
    }
    const store = tempStore();
    const workspace = new TaskWorkspace(store.workspaceRoot("tsk_ocr"));
    mkdirSync(join(store.workspaceRoot("tsk_ocr"), "sources"), { recursive: true });
    writeFileSync(
      join(store.workspaceRoot("tsk_ocr"), "sources/shop-floor-scan.pdf"),
      readFileSync(ensureScanFixture()),
    );

    const extracted = await extractPdfText(workspace, "sources/shop-floor-scan.pdf");
    expect(hasUsablePdfText(extracted.text)).toBe(false);

    const ocr = await ocrPdf(workspace, "sources/shop-floor-scan.pdf");
    expect(ocr.usedOcr).toBe(true);
    expect(ocr.engine).toBe("tesseract");
    expect(ocr.text).toMatch(/SHOP FLOOR SCAN/i);
    expect(ocr.text).toMatch(/Lots ready/i);
    expect(ocr.text).toMatch(/Splitrock Hardware/);
    expect(ocr.confidence).toBeGreaterThanOrEqual(70);
    expect(ocr.droppedUncertain).toEqual([]);

    const companies = extractCompanies([
      {
        path: "sources/ironwharf-canvas.md",
        text: "# Ironwharf Canvas\n\nFunding: $4.8 million seed\nProducts: Dodgers",
      },
      {
        path: "sources/shop-floor-scan.pdf",
        text: ocr.text,
        ocr: {
          confidence: ocr.confidence,
          lowConfidence: ocr.lowConfidence,
          wordsKept: ocr.wordsKept,
          wordsDropped: ocr.wordsDropped,
          droppedUncertain: ocr.droppedUncertain,
        },
      },
    ]);
    expect(companies.map((company) => company.name)).toEqual(["Ironwharf Canvas"]);
    expect(companies[0]?.funding).toMatch(/4\.8/);
    expect(companies[0]?.conflicts).toEqual([]);
  }, 30_000);

  it("recovers the scan-only mill invoice amount and does not invent it when OCR is empty", async () => {
    const invoice = join(process.cwd(), "fixtures/ironwharf-diligence/mill-invoice-scan.pdf");
    if (!existsSync(invoice)) {
      execSync("pnpm exec tsx fixtures/ironwharf-diligence/generate.ts", {
        cwd: process.cwd(),
        stdio: "pipe",
      });
    }
    if (!commandAvailable("tesseract") || !commandAvailable("pdftoppm")) {
      throw new Error("tesseract and pdftoppm are required for the noisy invoice scan test.");
    }
    const store = tempStore();
    const workspace = new TaskWorkspace(store.workspaceRoot("tsk_invoice"));
    mkdirSync(join(store.workspaceRoot("tsk_invoice"), "sources"), { recursive: true });
    writeFileSync(join(store.workspaceRoot("tsk_invoice"), "sources/mill-invoice-scan.pdf"), readFileSync(invoice));

    const extracted = await extractPdfText(workspace, "sources/mill-invoice-scan.pdf");
    expect(hasUsablePdfText(extracted.text)).toBe(false);

    const ocr = await ocrPdf(workspace, "sources/mill-invoice-scan.pdf");
    expect(ocr.text).toMatch(/410/);
    expect(ocr.text).toMatch(/invoice/i);

    const recovered = heuristicAnalysis(
      [
        {
          path: "sources/ironwharf-canvas.md",
          text: "# Ironwharf Canvas\n\nFunding: $4.8 million seed\nProducts: Dodgers",
        },
        {
          path: "sources/mill-invoice-scan.pdf",
          text: ocr.text,
          ocr: {
            confidence: ocr.confidence,
            lowConfidence: ocr.lowConfidence,
            wordsKept: ocr.wordsKept,
            wordsDropped: ocr.wordsDropped,
            droppedUncertain: ocr.droppedUncertain,
          },
        },
      ],
      "Supplier diligence",
    );
    expect(recovered.findings.some((finding) => /invoice/i.test(finding.finding) && /410/.test(finding.finding))).toBe(
      true,
    );
    expect(recovered.companies?.[0]?.funding).toMatch(/4\.8/);
    expect(recovered.companies?.[0]?.conflicts).toEqual([]);

    const unread = heuristicAnalysis(
      [
        {
          path: "sources/ironwharf-canvas.md",
          text: "# Ironwharf Canvas\n\nFunding: $4.8 million seed\nProducts: Dodgers",
        },
        {
          path: "sources/mill-invoice-scan.pdf",
          text: "",
          ocr: {
            confidence: 0,
            lowConfidence: true,
            wordsKept: 0,
            wordsDropped: 0,
            droppedUncertain: [],
          },
        },
      ],
      "Supplier diligence",
    );
    expect(unread.findings.some((finding) => finding.finding.includes(SCAN_ONLY_INVOICE))).toBe(false);
    expect(unread.uncertainties?.some((flag) => /did not recover a readable amount/i.test(flag.note))).toBe(true);
  }, 30_000);

  it("fails OCR on the unreadable twin scan and does not invent the hold figure", async () => {
    const hold = join(process.cwd(), "fixtures/ironwharf-diligence/bonded-hold-scan.pdf");
    if (!existsSync(hold)) {
      execSync("pnpm exec tsx fixtures/ironwharf-diligence/generate.ts", {
        cwd: process.cwd(),
        stdio: "pipe",
      });
    }
    if (!commandAvailable("tesseract") || !commandAvailable("pdftoppm")) {
      throw new Error("tesseract and pdftoppm are required for the unreadable hold scan test.");
    }
    const store = tempStore();
    const workspace = new TaskWorkspace(store.workspaceRoot("tsk_hold"));
    mkdirSync(join(store.workspaceRoot("tsk_hold"), "sources"), { recursive: true });
    writeFileSync(join(store.workspaceRoot("tsk_hold"), "sources/bonded-hold-scan.pdf"), readFileSync(hold));

    const extracted = await extractPdfText(workspace, "sources/bonded-hold-scan.pdf");
    expect(hasUsablePdfText(extracted.text)).toBe(false);

    const ocr = await ocrPdf(workspace, "sources/bonded-hold-scan.pdf");
    expect(ocr.text).not.toMatch(/287/);
    expect(ocr.text).not.toMatch(/\$/);
    expect(ocr.lowConfidence).toBe(true);

    const analysis = heuristicAnalysis(
      [
        {
          path: "sources/splitrock-hardware.md",
          text: "# Splitrock Hardware\n\nFunding: $1.6 million owner-funded\nProducts: clips",
        },
        {
          path: "sources/bonded-hold-scan.pdf",
          text: ocr.text,
          ocr: {
            confidence: ocr.confidence,
            lowConfidence: ocr.lowConfidence,
            wordsKept: ocr.wordsKept,
            wordsDropped: ocr.wordsDropped,
            droppedUncertain: ocr.droppedUncertain,
          },
        },
      ],
      "Supplier diligence",
    );
    expect(analysis.findings.some((finding) => finding.finding.includes(SCAN_ONLY_HOLD))).toBe(false);
    expect(analysis.findings.some((finding) => /287/.test(`${finding.finding} ${finding.evidence}`))).toBe(false);
    expect(
      analysis.uncertainties?.some(
        (flag) => /bonded-hold-scan|warehouse-hold/i.test(flag.note) && /did not recover a readable amount/i.test(flag.note),
      ),
    ).toBe(true);
  }, 30_000);
});
