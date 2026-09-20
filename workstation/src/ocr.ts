import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tidyExtractedText } from "./pdfs";
import type { CommandRunner } from "./isolation";
import type { TaskWorkspace } from "./workspace";

const WORD_MIN_CONFIDENCE = 60;
const LOW_MEAN_CONFIDENCE = 75;

export interface OcrWord {
  text: string;
  confidence: number;
  line: number;
}

export interface OcrResult {
  path: string;
  opened: true;
  usedOcr: true;
  engine: string;
  text: string;
  pages: number;
  confidence: number;
  lowConfidence: boolean;
  wordsKept: number;
  wordsDropped: number;
  droppedUncertain: string[];
  excerpt: string;
  error?: string;
}

export function commandAvailable(command: string): boolean {
  const probe = spawnSync(command, command === "pdftoppm" ? ["-v"] : ["--version"], {
    encoding: "utf8",
  });
  return probe.status === 0 || probe.status === 1;
}

export function parseTesseractTsv(tsv: string): OcrWord[] {
  const words: OcrWord[] = [];
  for (const raw of tsv.split(/\r?\n/)) {
    if (!raw || raw.startsWith("level")) continue;
    const cols = raw.split("\t");
    if (cols.length < 12) continue;
    const level = Number(cols[0]);
    if (level !== 5) continue;
    const confidence = Number(cols[10]);
    const text = (cols[11] ?? "").trim();
    if (!text || !Number.isFinite(confidence) || confidence < 0) continue;
    words.push({
      text,
      confidence,
      line: Number(cols[4]) || 0,
    });
  }
  return words;
}

export function textFromOcrWords(words: OcrWord[]): {
  text: string;
  kept: OcrWord[];
  dropped: OcrWord[];
  confidence: number;
} {
  const kept = words.filter((word) => word.confidence >= WORD_MIN_CONFIDENCE);
  const dropped = words.filter((word) => word.confidence < WORD_MIN_CONFIDENCE);
  const byLine = new Map<number, string[]>();
  for (const word of kept) {
    const line = byLine.get(word.line) ?? [];
    line.push(word.text);
    byLine.set(word.line, line);
  }
  const lines = [...byLine.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, parts]) => parts.join(" "));
  const confidence =
    kept.length === 0
      ? 0
      : Number((kept.reduce((sum, word) => sum + word.confidence, 0) / kept.length).toFixed(1));
  return { text: tidyExtractedText(lines.join("\n")), kept, dropped, confidence };
}

function looksLikeNumberToken(text: string): boolean {
  return /\$|million|billion|\d/.test(text);
}

export async function ocrPdf(
  workspace: TaskWorkspace,
  path: string,
  runner?: CommandRunner,
): Promise<OcrResult> {
  const empty = (error: string): OcrResult => ({
    path,
    opened: true,
    usedOcr: true,
    engine: "tesseract",
    text: "",
    pages: 0,
    confidence: 0,
    lowConfidence: true,
    wordsKept: 0,
    wordsDropped: 0,
    droppedUncertain: [],
    excerpt: "",
    error,
  });

  if (!commandAvailable("tesseract")) {
    return empty("tesseract is not installed. OCR cannot recover image-only pages.");
  }
  if (!commandAvailable("pdftoppm")) {
    return empty("pdftoppm is not installed. Cannot rasterize image-only PDF pages.");
  }

  const run: CommandRunner = runner ?? ((command, args, options) =>
    spawnSync(command, args, {
      encoding: "utf8",
      cwd: options?.cwd,
      maxBuffer: options?.maxBuffer ?? 8 * 1024 * 1024,
    }));

  const scratch = workspace.scratchDir("ocr");
  try {
    const pdfAbs = workspace.resolve(path);
    const prefix = join(scratch, "page");
    let raster = run("pdftoppm", ["-png", "-r", "200", pdfAbs, prefix]);
    if (raster.status !== 0 && runner) {
      raster = spawnSync("pdftoppm", ["-png", "-r", "200", pdfAbs, prefix], {
        encoding: "utf8",
      });
    }
    if (raster.status !== 0) {
      return empty(raster.stderr || "pdftoppm failed to rasterize the PDF.");
    }

    const images = readdirSync(scratch)
      .filter((name) => name.endsWith(".png"))
      .sort();
    if (images.length === 0) {
      return empty("Rasterizing the PDF produced no page images.");
    }

    const pageTexts: string[] = [];
    const allKept: OcrWord[] = [];
    const allDropped: OcrWord[] = [];
    for (const image of images) {
      let tsv = run(
        "tesseract",
        [join(scratch, image), "stdout", "tsv", "--psm", "6"],
        { maxBuffer: 8 * 1024 * 1024 },
      );
      if (tsv.status !== 0 && runner) {
        tsv = spawnSync("tesseract", [join(scratch, image), "stdout", "tsv", "--psm", "6"], {
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
        });
      }
      if (tsv.status !== 0) {
        return empty(tsv.stderr || "tesseract failed on a scanned page.");
      }
      const parsed = textFromOcrWords(parseTesseractTsv(tsv.stdout));
      if (parsed.text) pageTexts.push(parsed.text);
      allKept.push(...parsed.kept);
      allDropped.push(...parsed.dropped);
    }

    const assembled = textFromOcrWords(allKept);
    const droppedUncertain = allDropped
      .filter((word) => looksLikeNumberToken(word.text))
      .map((word) => word.text)
      .slice(0, 8);
    const confidence = assembled.confidence;
    const text = assembled.text;
    return {
      path,
      opened: true,
      usedOcr: true,
      engine: "tesseract",
      text,
      pages: images.length,
      confidence,
      lowConfidence: confidence < LOW_MEAN_CONFIDENCE || droppedUncertain.length > 0 || text.length < 12,
      wordsKept: allKept.length,
      wordsDropped: allDropped.length,
      droppedUncertain,
      excerpt: text.replace(/\s+/g, " ").trim().slice(0, 280),
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
