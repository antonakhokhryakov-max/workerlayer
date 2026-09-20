import type {
  Citation,
  CompanyRecord,
  Finding,
  RecordedAnalysis,
  ResearchReview,
  UncertaintyFlag,
} from "@aether/contracts";
import type { SourceNote } from "./memory";
import type { ModelProvider } from "./models/provider";

function pushFinding(findings: Finding[], finding: Finding): void {
  const key = `${finding.category}:${finding.finding}`.toLowerCase();
  if (findings.some((item) => `${item.category}:${item.finding}`.toLowerCase() === key)) {
    return;
  }
  findings.push(finding);
}

function labeledLines(text: string): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[-*•]\s*/, "").trim();
    const match = line.match(/^(?:\*\*)?([A-Za-z][A-Za-z0-9 /&-]{1,40})(?:\*\*)?\s*[:—-]\s+(.+)$/);
    if (match) {
      rows.push({ label: match[1].replace(/\*+/g, "").trim(), value: match[2].trim() });
    }
  }
  return rows;
}

const GENERIC_HEADING =
  /^(risk|growth|notes|customers|products|funding|prepared|subject|metrics|operating|vendor|revenue|capacity|comparison|summary|findings|sources|uncertainty|landscape|addendum|appendix|overview|table|memo)$/i;

function looksLikeCompanyName(name: string): boolean {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  return (
    trimmed.length >= 3 &&
    trimmed.length <= 70 &&
    words.length >= 2 &&
    !trimmed.includes(":") &&
    !GENERIC_HEADING.test(trimmed) &&
    !/operating notes|research pack|internal research|diligence|walk-through|survey notes|attached-vendor/i.test(
      trimmed,
    )
  );
}

function nameCore(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(co|inc|llc|ltd|corp|company|outdoor)\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function relatedCompanyNames(left: string, right: string): boolean {
  if (left.startsWith(right) || right.startsWith(left)) return true;
  const a = nameCore(left);
  const b = nameCore(right);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function mergeRelatedCompanies(companies: CompanyRecord[]): CompanyRecord[] {
  const sorted = [...companies].sort((a, b) => b.name.length - a.name.length);
  const kept: CompanyRecord[] = [];
  for (const company of sorted) {
    const parent = kept.find((item) => relatedCompanyNames(item.name, company.name));
    if (!parent) {
      kept.push(company);
      continue;
    }
    const longer = parent.name.length >= company.name.length ? parent : company;
    const shorter = longer === parent ? company : parent;
    for (const field of PROFILE_FIELDS) {
      if (!longer[field] && shorter[field]) longer[field] = shorter[field];
    }
    longer.sources = [...new Set([...longer.sources, ...shorter.sources])];
    longer.conflicts = [...longer.conflicts, ...shorter.conflicts];
    longer.missing = PROFILE_FIELDS.filter((field) => !longer[field]);
    if (longer !== parent) {
      kept.splice(kept.indexOf(parent), 1, longer);
    }
  }
  return kept;
}

function guessCompany(sources: SourceNote[]): string | undefined {
  for (const source of sources) {
    const heading = source.text.match(/^#\s+(.+)$/m);
    if (heading) return heading[1].trim();
    const named = source.text.match(/^(?:Company|Subject)\s*[:—-]\s*(.+)$/im);
    if (named) return named[1].trim();
  }
  return undefined;
}

function isForwardLooking(text: string): boolean {
  return /plan|planned|2026|expand|expansion|will |lead time|launch/i.test(text);
}

export function citationsFromSources(sources: SourceNote[]): Citation[] {
  return sources.map((source, index) => ({
    id: `S${index + 1}`,
    source: source.path.split("/").pop() ?? source.path,
    path: source.path,
    excerpt: source.text.replace(/\s+/g, " ").trim().slice(0, 180),
  }));
}

function citationFor(file: string, citations: Citation[]): Citation | undefined {
  return citations.find(
    (citation) => citation.source === file || citation.path.endsWith(file),
  );
}

const PROFILE_FIELDS = [
  "businessModel",
  "customers",
  "funding",
  "products",
  "differentiators",
] as const;

function fieldFromLabel(label: string): (typeof PROFILE_FIELDS)[number] | undefined {
  const lower = label.toLowerCase();
  if (lower.includes("business model") || lower === "model" || lower === "industry") return "businessModel";
  if (lower.includes("customer") || lower.includes("channel")) return "customers";
  if (lower.includes("funding") || lower.includes("raised") || lower.includes("revenue")) return "funding";
  if (lower.includes("product") || lower.includes("capabilit")) return "products";
  if (lower.includes("different") || lower.includes("edge")) return "differentiators";
  return undefined;
}

function firstMoney(text: string): string | undefined {
  return text.match(/\$[\d.,]+\s*(?:million|billion|[mb])?\b/i)?.[0];
}

function moneyKey(text: string): string | undefined {
  const match = text.match(/\$([\d.,]+)\s*(million|billion|mi\w*|[mb])?/i);
  if (!match) return undefined;
  const amount = match[1].replace(/,/g, "");
  const unit = (match[2] ?? "").toLowerCase();
  if (unit.startsWith("million") || unit.startsWith("mi") || unit === "m") return `$${amount}m`;
  if (unit.startsWith("billion") || unit === "b") return `$${amount}b`;
  return `$${amount}`;
}

function isTruncatedFact(longer: string, shorter: string): boolean {
  if (shorter.length < 4 || !longer.startsWith(shorter) || longer === shorter) return false;
  const next = longer[shorter.length] ?? "";
  return /[a-z\s.,;:)']/i.test(next);
}

function preferExistingFact(previous: string, value: string): "keep" | "replace" | "conflict" {
  if (previous === value) return "keep";
  if (isTruncatedFact(previous, value)) return "keep";
  if (isTruncatedFact(value, previous)) return "replace";
  const previousKey = moneyKey(previous);
  const nextKey = moneyKey(value);
  if (previousKey && nextKey && previousKey === nextKey) {
    return value.length > previous.length ? "replace" : "keep";
  }
  return "conflict";
}

function enrichCompaniesFromFindings(companies: CompanyRecord[], findings: Finding[]): void {
  for (const company of companies) {
    if (!company.funding) {
      const metric = findings.find(
        (finding) =>
          finding.category === "Metric" &&
          /\$/.test(`${finding.finding} ${finding.evidence}`) &&
          !/invoice|warehouse hold|bonded hold/i.test(`${finding.finding} ${finding.evidence}`),
      );
      if (metric) {
        company.funding = firstMoney(`${metric.finding} ${metric.evidence}`) ?? metric.finding;
      }
    }
    if (!company.businessModel) {
      const industry = findings.find((finding) => /^Industry\s*:/i.test(finding.finding));
      if (industry) {
        company.businessModel = industry.finding.replace(/^Industry\s*:\s*/i, "");
      }
    }
    company.missing = PROFILE_FIELDS.filter((field) => !company[field]);
  }
}

function isNonFundingMoneyLine(line: string): boolean {
  return /invoice|shop-floor hold|lots ready|open order|warehouse hold|bonded hold/i.test(line);
}

function ocrExpectedKind(file: string, text: string): "invoice" | "hold" | undefined {
  if (/invoice/i.test(file) || /invoice/i.test(text)) return "invoice";
  if (/hold-scan|warehouse hold|bonded hold/i.test(file) || /warehouse hold|bonded hold/i.test(text)) {
    return "hold";
  }
  return undefined;
}

function tableAndProseFields(text: string, name: string): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.includes(name)) continue;
    const money = firstMoney(line);
    if (money && !isNonFundingMoneyLine(line)) fields.push({ label: "Funding", value: money });
  }
  return fields;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Recover a known vendor name from a 1-character OCR slip. Does not invent numbers. */
export function alignOcrToKnownNames(text: string, known: string[]): string {
  let aligned = text;
  for (const name of known) {
    if (aligned.includes(name)) continue;
    const words = name.split(/\s+/);
    const first = words[0] ?? "";
    if (words.length < 2 || first.length < 5) continue;
    const rest = words.slice(1).join(" ");
    const pattern = new RegExp(`\\b[A-Za-z]${escapeRegExp(first.slice(1))}\\s+${escapeRegExp(rest)}\\b`, "g");
    aligned = aligned.replace(pattern, name);
  }
  return aligned;
}

function applyOverlappingAndTableFacts(
  byName: Map<string, CompanyRecord>,
  sources: SourceNote[],
  take: (name: string, file: string, fields: Array<{ label: string; value: string }>) => void,
): void {
  const known = [...byName.keys()];
  if (known.length === 0) return;
  for (const source of sources) {
    const file = source.path.split("/").pop() ?? source.path;
    const text = source.ocr ? alignOcrToKnownNames(source.text, known) : source.text;
    for (const name of known) {
      if (!text.includes(name)) continue;
      take(name, file, tableAndProseFields(text, name));
    }
  }
}

export function extractCompanies(sources: SourceNote[]): CompanyRecord[] {
  const byName = new Map<string, CompanyRecord>();

  const take = (name: string, file: string, fields: Array<{ label: string; value: string }>) => {
    const existing = byName.get(name) ?? {
      name,
      sources: [],
      missing: [],
      conflicts: [],
    };
    if (!existing.sources.includes(file)) existing.sources.push(file);
    for (const { label, value } of fields) {
      const key = fieldFromLabel(label);
      if (!key) continue;
      const previous = existing[key];
      if (!previous) {
        existing[key] = value;
        continue;
      }
      const decision = preferExistingFact(previous, value);
      if (decision === "replace") existing[key] = value;
      else if (decision === "conflict") {
        const conflict = existing.conflicts.find((item) => item.field === key);
        if (conflict) {
          if (!conflict.values.includes(value)) conflict.values.push(value);
        } else {
          existing.conflicts.push({ field: key, values: [previous, value] });
        }
      }
    }
    byName.set(name, existing);
  };

  for (const source of sources) {
    const file = source.path.split("/").pop() ?? source.path;
    if (!/^#\s+/m.test(source.text)) {
      const named = source.text.match(/^(?:Company|Subject)\s*[:—-]\s*(.+)$/im);
      if (named && looksLikeCompanyName(named[1].trim())) {
        take(named[1].trim(), file, labeledLines(source.text));
      }
      continue;
    }
    const chunks = source.text.split(/^#\s+/m).filter(Boolean);
    for (const chunk of chunks) {
      const [first, ...rest] = chunk.split(/\r?\n/);
      const name = (first ?? "").replace(/\s+—.*$/, "").trim();
      if (!looksLikeCompanyName(name)) continue;
      take(name, file, labeledLines([first, ...rest].join("\n")));
    }
  }

  applyOverlappingAndTableFacts(byName, sources, take);

  return mergeRelatedCompanies(
    [...byName.values()]
      .map((company) => {
        const missing = PROFILE_FIELDS.filter((field) => !company[field]);
        return { ...company, missing };
      })
      .filter(
        (company) =>
          PROFILE_FIELDS.some((field) => company[field]) || company.conflicts.length > 0,
      ),
  );
}

export function requestedSlideCount(goal: string, companyCount = 0): number | undefined {
  if (/10[- ]slide/i.test(goal) || /ten slide/i.test(goal)) return 10;
  if (/market overview/i.test(goal) || companyCount >= 8) return 10;
  return undefined;
}

export function heuristicAnalysis(
  sources: SourceNote[],
  goal: string,
  review?: ResearchReview,
): RecordedAnalysis {
  const citations = citationsFromSources(sources);
  const findings: Finding[] = [];
  const uncertainties: UncertaintyFlag[] = [];
  const companies = extractCompanies(sources);
  const company =
    companies.length >= 2
      ? `${companies.length}-company comparison`
      : companies[0]?.name ?? guessCompany(sources);

  for (const source of sources) {
    const file = source.path.split("/").pop() ?? source.path;
    const citation = citationFor(file, citations);
    for (const { label, value } of labeledLines(source.text)) {
      const lower = label.toLowerCase();
      const category = lower.includes("risk")
        ? "Risk"
        : lower.includes("revenue") ||
            lower.includes("headcount") ||
            lower.includes("growth") ||
            lower.includes("invoice")
          ? "Metric"
          : lower.includes("product") || lower.includes("market") || lower.includes("customer")
            ? "Business"
            : lower.includes("found") || lower.includes("hq") || lower.includes("location")
              ? "Profile"
              : "Fact";
      const text = `${label}: ${value.replace(/\*+/g, "")}`;
      const uncertain = isForwardLooking(text);
      pushFinding(findings, {
        category,
        finding: text,
        evidence: value.slice(0, 240),
        source: file,
        confidence: uncertain ? "medium" : "high",
        citationId: citation?.id,
        uncertain,
        uncertaintyNote: uncertain
          ? "Forward-looking or not independently corroborated."
          : undefined,
      });
      if (uncertain) {
        uncertainties.push({
          id: `U${uncertainties.length + 1}`,
          note: `${text} is drawn from a single attached source.`,
          reason: "forward-looking",
          relatedFinding: text,
        });
      }
    }

    const bullets = source.text.match(/^[-*•]\s+(.+)$/gm) ?? [];
    for (const bullet of bullets.slice(0, 8)) {
      const text = bullet.replace(/^[-*•]\s+/, "").trim();
      if (text.length < 12) continue;
      const uncertain = /risk|season|freight|supply|plan/i.test(text) || isForwardLooking(text);
      pushFinding(findings, {
        category: /risk|season|freight|supply/i.test(text) ? "Risk" : "Note",
        finding: text,
        evidence: text,
        source: file,
        confidence: "medium",
        citationId: citation?.id,
        uncertain,
        uncertaintyNote: uncertain ? "Single-source note; treat as provisional." : undefined,
      });
    }
  }

  for (const source of sources) {
    if (!source.ocr) continue;
    const file = source.path.split("/").pop() ?? source.path;
    const citation = citationFor(file, citations);
    const known = companies.map((item) => item.name);
    const text = alignOcrToKnownNames(source.text, known);
    const kind = ocrExpectedKind(file, text);
    const money = firstMoney(text);
    if (kind === "invoice" && money) {
      pushFinding(findings, {
        category: "Metric",
        finding: `Unpaid mill invoice: ${money}`,
        evidence: text.replace(/\s+/g, " ").trim().slice(0, 240),
        source: file,
        confidence: source.ocr.lowConfidence ? "low" : "medium",
        citationId: citation?.id,
        uncertain: true,
        uncertaintyNote: "Recovered from an image-only scan by OCR. Single-source. Do not treat as verified.",
      });
    } else if (kind === "hold" && money) {
      pushFinding(findings, {
        category: "Metric",
        finding: `Bonded warehouse hold: ${money}`,
        evidence: text.replace(/\s+/g, " ").trim().slice(0, 240),
        source: file,
        confidence: source.ocr.lowConfidence ? "low" : "medium",
        citationId: citation?.id,
        uncertain: true,
        uncertaintyNote: "Recovered from an image-only scan by OCR. Single-source. Do not treat as verified.",
      });
    } else if (kind) {
      uncertainties.push({
        id: `U${uncertainties.length + 1}`,
        note:
          kind === "invoice"
            ? `${file} is an image-only mill invoice scan. OCR did not recover a readable amount. No number was invented.`
            : `${file} is an image-only warehouse-hold scan. OCR did not recover a readable amount. No number was invented.`,
        reason: "gap",
      });
    }
  }

  enrichCompaniesFromFindings(companies, findings);

  if (findings.length === 0) {
    const excerpt = sources.map((source) => source.text.slice(0, 280)).join(" ").trim();
    pushFinding(findings, {
      category: "Overview",
      finding: excerpt || "Attached materials did not yield structured facts.",
      evidence: goal,
      source: sources[0]?.path.split("/").pop() ?? "materials",
      confidence: excerpt ? "medium" : "low",
      citationId: citations[0]?.id,
      uncertain: true,
      uncertaintyNote: "Limited structure in the attached pack.",
    });
  }

  for (const gap of review?.gaps ?? []) {
    uncertainties.push({
      id: `U${uncertainties.length + 1}`,
      note: gap,
      reason: "gap",
    });
  }

  if (!review) {
    uncertainties.push({
      id: `U${uncertainties.length + 1}`,
      note: "Analysis is limited to attached materials; no open-web confirmation.",
      reason: "unverified",
    });
  }

  for (const source of sources) {
    if (!source.ocr) continue;
    const file = source.path.split("/").pop() ?? source.path;
    const dropped =
      source.ocr.droppedUncertain.length > 0
        ? ` Low-confidence number-like tokens were dropped: ${source.ocr.droppedUncertain.join(", ")}.`
        : "";
    uncertainties.push({
      id: `U${uncertainties.length + 1}`,
      note: source.ocr.lowConfidence
        ? `${file} was recovered by OCR at ${source.ocr.confidence}% confidence. Treat scan figures as provisional.${dropped}`
        : `${file} was recovered by OCR at ${source.ocr.confidence}% confidence. Scan figures are still single-source.`,
      reason: "unverified",
    });
    if (!source.text.trim()) {
      uncertainties.push({
        id: `U${uncertainties.length + 1}`,
        note: `${file} has no usable text layer and OCR did not recover readable rows. No numbers were invented from the scan.`,
        reason: "gap",
      });
    }
  }

  for (const record of companies) {
    for (const conflict of record.conflicts) {
      uncertainties.push({
        id: `U${uncertainties.length + 1}`,
        note: `${record.name} has conflicting ${conflict.field} in the attached pack (${conflict.values.join(" vs ")}). Could not be verified.`,
        reason: "unverified",
        relatedFinding: record.name,
      });
    }
    if (record.missing.length > 0) {
      uncertainties.push({
        id: `U${uncertainties.length + 1}`,
        note: `${record.name} is missing ${record.missing.join(", ")} in the attached materials.`,
        reason: "gap",
        relatedFinding: record.name,
      });
    }
  }

  return {
    company,
    summary:
      companies.length >= 2
        ? `Comparison of ${companies.length} companies from attached materials. Incomplete and conflicting facts are flagged.`
        : company
          ? `${company} — analysis of attached materials for the assigned knowledge-work goal.`
          : "Analysis of attached materials for the assigned knowledge-work goal.",
    findings,
    citations,
    uncertainties,
    companies,
  };
}

export async function synthesizeAnalysis(
  model: ModelProvider,
  sources: SourceNote[],
  goal: string,
  review?: ResearchReview,
): Promise<RecordedAnalysis> {
  const fallback = heuristicAnalysis(sources, goal, review);
  if (model.kind !== "llm") {
    return fallback;
  }

  const corpus = sources
    .map((source) => `SOURCE ${source.path}\n${source.text}`)
    .join("\n\n")
    .slice(0, 12000);

  const raw = await model.complete(
    [
      "Produce JSON only with shape:",
      '{ "company": string, "summary": string, "findings": [{ "category", "finding", "evidence", "source", "confidence": "high"|"medium"|"low", "citationId", "uncertain", "uncertaintyNote" }], "citations": [{ "id", "source", "path", "excerpt" }], "uncertainties": [{ "id", "note", "reason" }] }',
      "Cite attached sources. Flag uncertainty. Do not invent sources.",
      `Goal: ${goal}`,
      review ? `Research review: ${JSON.stringify(review)}` : "",
      corpus,
    ].join("\n\n"),
  );

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]) as RecordedAnalysis;
    if (!Array.isArray(parsed.findings) || parsed.findings.length === 0) {
      return fallback;
    }
    return {
      ...fallback,
      ...parsed,
      citations: parsed.citations?.length ? parsed.citations : fallback.citations,
      uncertainties: parsed.uncertainties?.length
        ? parsed.uncertainties
        : fallback.uncertainties,
      companies: parsed.companies?.length ? parsed.companies : fallback.companies,
    };
  } catch {
    return fallback;
  }
}

export function spreadsheetFromAnalysis(
  analysis: RecordedAnalysis,
  goal: string,
  pass: "draft" | "corrected" = "corrected",
): { filename: string; title: string; sheets: Array<{ name: string; rows: Array<Array<string | number | null>> }> } {
  const company = analysis.company ?? "Research subject";
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "findings";
  const citations = analysis.citations ?? [];
  const companies = analysis.companies ?? [];
  const sheets: Array<{ name: string; rows: Array<Array<string | number | null>> }> = [
    {
      name: "Summary",
      rows: [
        ["Field", "Value"],
        ["Company", company],
        ["Goal", goal],
        ["Companies compared", companies.length],
        ["Finding count", analysis.findings.length],
        ["Cited sources", citations.length],
        ["Uncertainty flags", analysis.uncertainties?.length ?? 0],
        ["Summary", analysis.summary ?? ""],
      ],
    },
  ];

  if (companies.length >= 2) {
    sheets.push({
      name: "Comparison",
      rows: [
        [
          "Company",
          "Business model",
          "Customers",
          "Funding",
          "Product capabilities",
          "Differentiators",
          "Sources",
          "Missing",
          "Conflicts",
        ],
        ...companies.map((record) => [
          record.name,
          record.businessModel ?? "",
          record.customers ?? "",
          record.funding ?? "",
          record.products ?? "",
          record.differentiators ?? "",
          record.sources.join("; "),
          record.missing.join(", "),
          record.conflicts.map((item) => `${item.field}: ${item.values.join(" vs ")}`).join("; "),
        ]),
      ],
    });
  }

  sheets.push(
    {
      name: "Findings",
      rows: [
        ["#", "Category", "Finding", "Evidence", "Source", "Citation", "Confidence", "Uncertain", "Uncertainty note"],
        ...analysis.findings.map((finding, index) => [
          index + 1,
          finding.category,
          finding.finding,
          finding.evidence,
          finding.source,
          finding.citationId ?? "",
          finding.confidence,
          finding.uncertain ? "yes" : "no",
          finding.uncertaintyNote ?? "",
        ]),
      ],
    },
    {
      name: "Sources",
      rows: [
        ["ID", "Source", "Path", "Excerpt"],
        ...citations.map((citation) => [
          citation.id,
          citation.source,
          citation.path,
          citation.excerpt ?? "",
        ]),
      ],
    },
  );

  if (pass !== "draft") {
    sheets.push({
      name: "Uncertainty",
      rows: [
        ["ID", "Reason", "Note"],
        ...(analysis.uncertainties ?? []).map((flag) => [
          flag.id,
          flag.reason,
          flag.note,
        ]),
      ],
    });
  }

  return {
    filename: `${slug}-findings.xlsx`,
    title: `${company} knowledge-work findings`,
    sheets,
  };
}
