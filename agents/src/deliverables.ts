import type { RecordedAnalysis, ResearchReview } from "@aether/contracts";
import { requestedSlideCount } from "./analysis";

export function companySlug(company?: string): string {
  return company?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "research";
}

function stripMoney(text: string): string {
  return text.replace(/\$[\d.,]+\s*(?:million|billion|[mb])?\b/gi, "an amount not restated here");
}

function canonicalMoney(raw: string): string {
  const amount = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return raw.replace(/\s+/g, " ");
  if (/billion|[0-9.]b\b|\bb\b/i.test(raw) && !/million/i.test(raw)) return `$${amount} billion`;
  if (/million|[0-9.]m\b|\bm\b/i.test(raw)) return `$${amount} million`;
  return `$${amount}`;
}

function moneyMentions(text: string): string[] {
  return unique(
    [...text.matchAll(/\$[\d.,]+\s*(?:million|billion|[mb])?\b/gi)].map((match) =>
      canonicalMoney(match[0]),
    ),
  );
}

function requiredFigures(analysis: RecordedAnalysis): string[] {
  return unique([
    ...(analysis.companies ?? []).flatMap((company) => [
      ...moneyMentions(company.funding ?? ""),
      ...company.conflicts.flatMap((conflict) => conflict.values.flatMap((value) => moneyMentions(value))),
    ]),
    ...(analysis.findings ?? [])
      .filter((finding) => finding.category === "Metric")
      .flatMap((finding) => moneyMentions(`${finding.finding} ${finding.evidence}`)),
  ]);
}

function ensureSendableSlides(
  slides: Array<{ title: string; bullets: string[]; footer?: string }>,
  analysis: RecordedAnalysis,
  pass: "draft" | "corrected",
  footer: string,
): Array<{ title: string; bullets: string[]; footer?: string }> {
  const citations = analysis.citations ?? [];
  const companies = analysis.companies ?? [];
  let next = slides.map((slide) => ({
    ...slide,
    bullets: nonempty(slide.bullets, "See the supporting spreadsheet for detail."),
    footer: slide.footer ?? footer,
  }));

  if (!next.some((slide) => /source|citation/i.test(slide.title))) {
    next.push({
      title: "Sources cited",
      bullets: nonempty(
        citations.map((citation) => `[${citation.id}] ${citation.source}`),
        "Attached materials — see the spreadsheet Sources sheet.",
      ),
      footer,
    });
  }
  if (!next.some((slide) => /uncertain|gap|conflict/i.test(slide.title))) {
    next.push({
      title: "Uncertainty and gaps",
      bullets: nonempty(
        (analysis.uncertainties ?? []).map((flag) => flag.note),
        "Limited to attached materials; do not treat a single memo as verified.",
      ),
      footer,
    });
  }

  if (pass === "corrected") {
    const deck = next.flatMap((slide) => [slide.title, ...slide.bullets]).join("\n");
    const missingNames = companies.filter((company) => {
      const token = company.name.split(" ")[0] ?? company.name;
      return !deck.includes(company.name) && !deck.includes(token);
    });
    const missingMoney = requiredFigures(analysis).filter((amount) => !deck.toLowerCase().includes(amount.toLowerCase()));
    if (missingNames.length > 0 || missingMoney.length > 0) {
      next.splice(Math.max(next.length - 2, 1), 0, {
        title: "Figures and names from the pack",
        bullets: nonempty(
          [
            ...missingNames.map((company) =>
              company.funding ? `${company.name}: ${company.funding}` : company.name,
            ),
            ...missingMoney.map((amount) => `Figure from the pack: ${amount}`),
          ],
          "See the comparison spreadsheet.",
        ),
        footer,
      });
    }
  }

  return next.map((slide) => ({
    ...slide,
    bullets: nonempty(slide.bullets, "See the supporting spreadsheet for detail."),
  }));
}

export function presentationFromAnalysis(
  analysis: RecordedAnalysis,
  review: ResearchReview | undefined,
  goal: string,
  pass: "draft" | "corrected" = "corrected",
): { filename: string; title: string; slides: Array<{ title: string; bullets: string[]; footer?: string }> } {
  const companies = analysis.companies ?? [];
  const want = requestedSlideCount(goal, companies.length);
  if (want === 10 || companies.length >= 8) {
    return marketPresentation(analysis, review, goal, pass);
  }
  if (companies.length >= 2) {
    return comparisonPresentation(analysis, review, goal, pass);
  }
  return singleSubjectPresentation(analysis, review, goal, pass);
}

function singleSubjectPresentation(
  analysis: RecordedAnalysis,
  review: ResearchReview | undefined,
  goal: string,
  pass: "draft" | "corrected",
): { filename: string; title: string; slides: Array<{ title: string; bullets: string[]; footer?: string }> } {
  const company = analysis.company ?? "Research subject";
  const citations = analysis.citations ?? [];
  const highlights = analysis.findings.filter((finding) => !finding.uncertain).slice(0, 5);
  const metrics = analysis.findings.filter((finding) => finding.category === "Metric").slice(0, 4);
  const risks = analysis.findings.filter((finding) => finding.category === "Risk").slice(0, 4);
  const uncertain = (analysis.uncertainties ?? []).slice(0, 5);
  const footer = "WorkerLayer · attached materials only · not independently verified";
  const restated = (text: string) => (pass === "draft" ? stripMoney(text) : text);

  const built = {
    filename: `${companySlug(company)}-briefing.pptx`,
    title: `${company} — short briefing`,
    slides: [
      {
        title: `${company}`,
        bullets: [
          "Knowledge-work briefing from attached materials only.",
          restated(analysis.summary ?? "Structured findings from the assigned pack."),
          "Finance figures, if present, are example data in the sources — not the product.",
        ],
        footer,
      },
      {
        title: "Assignment and method",
        bullets: [
          goal,
          "Read the files in the governed task environment.",
          review?.method === "attached-materials-only"
            ? "No open-web or browser research in this stage."
            : "Sources reviewed inside the task environment.",
          `Coverage: ${(review?.coverage ?? ["Attached pack"]).join("; ") || "Attached pack"}.`,
        ],
        footer,
      },
      {
        title: "Most important findings",
        bullets:
          highlights.length > 0
            ? highlights.map((finding) => restated(`${finding.finding} [${finding.citationId ?? finding.source}]`))
            : ["See the supporting spreadsheet for the full finding list."],
        footer,
      },
      {
        title: "Numbers from the pack",
        bullets:
          metrics.length > 0
            ? metrics.map((finding) => restated(`${finding.finding} [${finding.citationId ?? finding.source}]`))
            : ["No labeled metrics were in the attached materials."],
        footer,
      },
      {
        title: "Risks called out in the pack",
        bullets:
          risks.length > 0
            ? risks.map((finding) => `${finding.finding} [${finding.citationId ?? finding.source}]`)
            : ["No explicit risks were labeled in the attached materials."],
        footer,
      },
      {
        title: "Uncertainty and gaps",
        bullets:
          uncertain.length > 0
            ? uncertain.map((flag) => flag.note)
            : ["Uncertainty was not separately flagged."],
        footer,
      },
      {
        title: "Sources cited",
        bullets:
          citations.length > 0
            ? citations.map((citation) => `[${citation.id}] ${citation.source}`)
            : ["No source list was recorded."],
        footer,
      },
    ],
  };
  return { ...built, slides: ensureSendableSlides(built.slides, analysis, pass, footer) };
}

function comparisonPresentation(
  analysis: RecordedAnalysis,
  review: ResearchReview | undefined,
  goal: string,
  pass: "draft" | "corrected",
): { filename: string; title: string; slides: Array<{ title: string; bullets: string[]; footer?: string }> } {
  const companies = analysis.companies ?? [];
  const citations = analysis.citations ?? [];
  const footer = "WorkerLayer · attached materials only · not independently verified";
  const restated = (text: string) => (pass === "draft" ? stripMoney(text) : text);
  const metrics = analysis.findings.filter((finding) => finding.category === "Metric").slice(0, 6);
  const highlights = analysis.findings.filter((finding) => !finding.uncertain).slice(0, 6);
  const uncertain = (analysis.uncertainties ?? []).slice(0, 6);

  const built = {
    filename: `${companySlug(analysis.company)}-briefing.pptx`,
    title: `${companies.length}-company comparison`,
    slides: [
      {
        title: `${companies.length}-company comparison`,
        bullets: [
          restated(analysis.summary ?? `Comparison of ${companies.length} companies from attached materials.`),
          "Knowledge-work briefing from attached materials only.",
          "Finance figures, if present, are example data in the sources — not the product.",
        ],
        footer,
      },
      {
        title: "Assignment and method",
        bullets: [
          goal,
          review?.method === "attached-materials-only"
            ? "No open-web or browser research in this stage."
            : "Sources reviewed inside the task environment.",
          "Self-review: create, inspect, check, then correct before delivery.",
        ],
        footer,
      },
      {
        title: "Who is being compared",
        bullets: companies.map((company) =>
          restated(
            `${company.name} — ${company.businessModel ?? "model not stated"}${company.funding ? `; ${company.funding}` : ""}`,
          ),
        ),
        footer,
      },
      {
        title: "Numbers from the pack",
        bullets: nonempty(
          [
            ...companies
              .filter((company) => company.funding)
              .map((company) => restated(`${company.name}: ${company.funding}`)),
            ...metrics.map((finding) => restated(`${finding.finding} [${finding.citationId ?? finding.source}]`)),
            ...requiredFigures(analysis).map((amount) => restated(`Figure from the pack: ${amount}`)),
          ],
          "No labeled metrics were in the attached materials.",
        ),
        footer,
      },
      {
        title: "Most important findings",
        bullets:
          highlights.length > 0
            ? highlights.map((finding) => restated(`${finding.finding} [${finding.citationId ?? finding.source}]`))
            : ["See the supporting spreadsheet for the full finding list."],
        footer,
      },
      {
        title: "Uncertainty, conflicts, and gaps",
        bullets: nonempty(
          [
            ...companies.flatMap((company) =>
              company.conflicts.map(
                (item) => `${company.name}: ${item.field} conflict (${item.values.join(" vs ")})`,
              ),
            ),
            ...uncertain.map((flag) => flag.note),
          ],
          "Limited to attached materials; do not treat a single memo as verified.",
        ),
        footer,
      },
      {
        title: "Sources cited",
        bullets: nonempty(
          citations.map((citation) => `[${citation.id}] ${citation.source}`),
          "Attached materials — see the spreadsheet Sources sheet.",
        ),
        footer,
      },
    ],
  };
  return { ...built, slides: ensureSendableSlides(built.slides, analysis, pass, footer) };
}

function marketPresentation(
  analysis: RecordedAnalysis,
  review: ResearchReview | undefined,
  goal: string,
  pass: "draft" | "corrected",
): { filename: string; title: string; slides: Array<{ title: string; bullets: string[]; footer?: string }> } {
  const companies = analysis.companies ?? [];
  const citations = analysis.citations ?? [];
  const footer = "WorkerLayer · attached materials only · cite before using";
  const models = unique(companies.map((company) => company.businessModel).filter(Boolean) as string[]);
  const conflicts = companies.filter((company) => company.conflicts.length > 0);
  const missing = companies.filter((company) => company.missing.length > 0);
  const names = companies.map((company) => company.name);

  const slides = [
    {
      title: "Outdoor living market overview",
      bullets: [
        analysis.summary ?? `Review of ${companies.length} companies from the attached pack.`,
        "This is knowledge work — not a finance product.",
        "Every figure below comes from attached or approved sources only.",
      ],
      footer,
    },
    {
      title: "Assignment and method",
      bullets: [
        goal,
        `Reviewed ${companies.length} company profiles plus supporting PDFs.`,
        review?.method === "attached-materials-only"
          ? "No open-web browser research. Gaps stay visible."
          : "Sources reviewed inside the task environment.",
        "Self-review: create, inspect, check, then correct before delivery.",
      ],
      footer,
    },
    {
      title: "Who is in the landscape",
      bullets: chunk(names, 6).map((group) => group.join(" · ")),
      footer,
    },
    {
      title: "Business models",
      bullets:
        models.length > 0
          ? models.slice(0, 6)
          : ["Business models were not consistently labeled in the pack."],
      footer,
    },
    {
      title: "Customers and channels",
      bullets: nonempty(
        companies
          .filter((company) => company.customers)
          .slice(0, 6)
          .map((company) => `${company.name}: ${company.customers}`),
        "Customers were not consistently labeled in the pack.",
      ),
      footer,
    },
    {
      title: "Product capabilities",
      bullets: nonempty(
        companies
          .filter((company) => company.products)
          .slice(0, 6)
          .map((company) => `${company.name}: ${company.products}`),
        "Product capabilities were not consistently labeled in the pack.",
      ),
      footer,
    },
    {
      title: "Differentiators",
      bullets: nonempty(
        companies
          .filter((company) => company.differentiators)
          .slice(0, 6)
          .map((company) => `${company.name}: ${company.differentiators}`),
        "Differentiators were not consistently labeled in the pack.",
      ),
      footer,
    },
    {
      title: "Funding picture (known vs unknown)",
      bullets: nonempty(
        [
          ...companies
            .filter((company) => company.funding)
            .map((company) => `${company.name}: ${company.funding}`),
          ...analysis.findings
            .filter((finding) => finding.category === "Metric")
            .slice(0, 4)
            .map((finding) => finding.finding),
          `${companies.filter((company) => company.missing.includes("funding")).length} companies have no funding figure in the pack.`,
        ],
        "No funding figures were disclosed in the attached pack.",
      ),
      footer,
    },
    {
      title: "Uncertainty, conflicts, and gaps",
      bullets: [
        ...conflicts.map(
          (company) =>
            `${company.name}: ${company.conflicts.map((item) => `${item.field} conflict (${item.values.join(" vs ")})`).join("; ")}`,
        ),
        ...missing.slice(0, 4).map((company) => `${company.name} missing ${company.missing.join(", ")}.`),
        "Do not treat a single attached memo as verified.",
      ],
      footer,
    },
    {
      title: "Sources cited",
      bullets: nonempty(
        citations.slice(0, 8).map((citation) => `[${citation.id}] ${citation.source}`),
        "Attached materials — see the spreadsheet Sources sheet.",
      ),
      footer,
    },
  ];

  const usable = pass === "draft" ? slides.slice(0, 6) : slides;
  return {
    filename: `${companySlug(analysis.company)}-briefing.pptx`,
    title: "Market overview",
    slides: ensureSendableSlides(usable, analysis, pass, footer),
  };
}

function nonempty(bullets: string[], fallback: string): string[] {
  const usable = bullets.filter((bullet) => bullet.trim().length > 0);
  return usable.length > 0 ? usable : [fallback];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

export function documentFromAnalysis(
  analysis: RecordedAnalysis,
  review: ResearchReview | undefined,
  goal: string,
): { filename: string; title: string; markdown: string } {
  const company = analysis.company ?? "Research subject";
  const citations = analysis.citations ?? [];
  const companies = analysis.companies ?? [];
  const lines: string[] = [
    `# ${company} — written summary`,
    "",
    "Prepared by WorkerLayer from **attached materials only**. This is knowledge work, not a financial product.",
    "",
    "## Assignment",
    "",
    goal,
    "",
    "## Snapshot",
    "",
    analysis.summary ?? "Findings drawn from the assigned source pack.",
    "",
  ];

  if (companies.length >= 2) {
    lines.push("## Company comparison", "");
    for (const record of companies) {
      lines.push(`- **${record.name}** — ${record.businessModel ?? "model not stated"}; products: ${record.products ?? "n/a"}.`);
    }
    lines.push("");
  }

  lines.push("## Most important findings", "");
  for (const finding of analysis.findings.slice(0, 10)) {
    const cite = finding.citationId ? ` [${finding.citationId}]` : ` (${finding.source})`;
    const flag = finding.uncertain ? " — *uncertain*" : "";
    lines.push(`- **${finding.category}:** ${finding.finding}${cite}${flag}`);
  }

  lines.push("", "## Uncertainty", "");
  if ((analysis.uncertainties ?? []).length === 0) {
    lines.push("- No separate uncertainty flags were recorded.");
  } else {
    for (const flag of analysis.uncertainties ?? []) {
      lines.push(`- **${flag.reason}:** ${flag.note}`);
    }
  }

  if (review?.gaps?.length) {
    lines.push("", "## Research limits", "");
    lines.push(`Method: ${review.method.replaceAll("-", " ")}.`);
    for (const gap of review.gaps) {
      lines.push(`- ${gap}`);
    }
  }

  lines.push("", "## Sources", "");
  for (const citation of citations) {
    lines.push(`- **[${citation.id}]** ${citation.source} — ${citation.excerpt ?? citation.path}`);
  }
  lines.push("");

  return {
    filename: `${companySlug(company)}-summary.md`,
    title: `${company} written summary`,
    markdown: lines.join("\n"),
  };
}
