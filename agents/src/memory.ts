import type {
  ArtifactKind,
  Citation,
  CompanyRecord,
  Finding,
  FixTarget,
  HandledAction,
  QualityReport,
  ResearchReview,
  UncertaintyFlag,
  WorkPlan,
} from "@aether/contracts";

export interface SourceOcrNote {
  confidence: number;
  lowConfidence: boolean;
  wordsKept: number;
  wordsDropped: number;
  droppedUncertain: string[];
}

export interface SourceNote {
  path: string;
  text: string;
  ocr?: SourceOcrNote;
}

export function hasUsableSourceText(text: string): boolean {
  const cleaned = text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length >= 40 && /[A-Za-z]{3,}/.test(cleaned);
}

export class WorkingMemory {
  plan?: WorkPlan;
  sources: SourceNote[] = [];
  findings: Finding[] = [];
  citations: Citation[] = [];
  uncertainties: UncertaintyFlag[] = [];
  companies: CompanyRecord[] = [];
  research?: ResearchReview;
  company?: string;
  summary?: string;
  created: Partial<Record<Exclude<ArtifactKind, "file">, string>> = {};
  validatedPaths = new Set<string>();
  observations: HandledAction[] = [];
  inspectCount = 0;
  qualityReports: QualityReport[] = [];
  correctionsApplied = 0;
  attemptedGapFill = false;
  attemptedApprovedFetch = false;
  attemptedCrossTask = false;
  attemptedSandbox = false;
  governanceDenials: Array<{ tool: string; reason: string }> = [];
  openedPaths = new Set<string>();
  ocrPaths = new Set<string>();
  humanFix?: { target: FixTarget; applied: boolean; inspected: boolean; checked: boolean };

  get spreadsheetPath(): string | undefined {
    return this.created.spreadsheet;
  }

  get validated(): boolean {
    return this.allDeliverablesReady;
  }

  get reviewCycleComplete(): boolean {
    return this.inspectCount >= 2 && this.qualityReports.length >= 1 && this.correctionsApplied >= 1;
  }

  get allDeliverablesReady(): boolean {
    const needed = ["spreadsheet", "presentation"] as const;
    const createdReady = needed.every((kind) => {
      const path = this.created[kind];
      return Boolean(path && this.validatedPaths.has(path));
    });
    const documentReady = !this.created.document || this.validatedPaths.has(this.created.document);
    return createdReady && documentReady && this.reviewCycleComplete;
  }

  unvalidatedPaths(): string[] {
    return (["spreadsheet", "presentation", "document"] as const)
      .map((kind) => this.created[kind])
      .filter((path): path is string => Boolean(path) && !this.validatedPaths.has(path!));
  }

  latestQuality(): QualityReport | undefined {
    return this.qualityReports.at(-1);
  }

  recordedAnalysis() {
    return {
      company: this.company,
      summary: this.summary,
      findings: this.findings,
      citations: this.citations,
      uncertainties: this.uncertainties,
      companies: this.companies,
    };
  }

  remember(handled: HandledAction): void {
    this.observations.push(handled);
    const data = handled.result.data ?? {};

    if (handled.request.tool === "workspace.read_file" && data.content) {
      this.upsertSource(String(data.path), String(data.content));
    }
    if (handled.request.tool === "pdf.extract_text" && data.text) {
      this.upsertSource(String(data.path), String(data.text));
    }
    if (handled.request.tool === "pdf.open") {
      const path = String(data.path ?? handled.request.args.path ?? "");
      if (path) {
        this.openedPaths.add(path);
        this.upsertSource(path, String(data.text ?? ""));
      }
    }
    if (handled.request.tool === "pdf.ocr") {
      const path = String(data.path ?? handled.request.args.path ?? "");
      if (path) {
        this.ocrPaths.add(path);
        this.openedPaths.add(path);
        this.upsertSource(path, String(data.text ?? ""), {
          confidence: Number(data.confidence ?? 0),
          lowConfidence: Boolean(data.lowConfidence),
          wordsKept: Number(data.wordsKept ?? 0),
          wordsDropped: Number(data.wordsDropped ?? 0),
          droppedUncertain: Array.isArray(data.droppedUncertain)
            ? data.droppedUncertain.map((item) => String(item))
            : [],
        });
      }
    }
    if (handled.request.tool === "spreadsheet.open" && data.text) {
      this.upsertSource(String(data.path), String(data.text));
      this.openedPaths.add(String(data.path));
    }
    if (handled.request.tool === "workspace.ingest_sources" && Array.isArray(data.sources)) {
      for (const source of data.sources as Array<{ path?: string; text?: string }>) {
        if (source.path && source.text) this.upsertSource(source.path, source.text);
      }
    }
    if (handled.request.tool === "research.review_sources" && data.review) {
      this.research = data.review as ResearchReview;
    }
    if (handled.request.tool === "analysis.record_findings") {
      const analysis = (data.analysis ?? {}) as {
        company?: string;
        summary?: string;
        findings?: Finding[];
        citations?: Citation[];
        uncertainties?: UncertaintyFlag[];
        companies?: CompanyRecord[];
      };
      this.company = analysis.company ?? this.company;
      this.summary = analysis.summary ?? this.summary;
      this.findings = analysis.findings ?? this.findings;
      this.citations = analysis.citations ?? this.citations;
      this.uncertainties = analysis.uncertainties ?? this.uncertainties;
      this.companies = analysis.companies ?? this.companies;
    }
    if (handled.result.ok && typeof data.path === "string" && typeof data.kind === "string") {
      const kind = data.kind as ArtifactKind;
      if (kind === "spreadsheet" || kind === "presentation" || kind === "document") {
        this.created[kind] = data.path;
        this.validatedPaths.delete(data.path);
      }
    }
    if (handled.request.tool === "artifact.inspect" && handled.result.ok) {
      this.inspectCount += 1;
    }
    if (handled.request.tool === "quality.check" && data.report) {
      this.qualityReports.push(data.report as QualityReport);
    }
    if (
      handled.result.ok &&
      this.qualityReports.length > 0 &&
      (handled.request.tool === "spreadsheet.update" ||
        handled.request.tool === "presentation.create" ||
        handled.request.tool === "document.create")
    ) {
      this.correctionsApplied += 1;
    }
    if (handled.request.tool === "artifact.validate" && data.valid && typeof data.path === "string") {
      this.validatedPaths.add(data.path);
    }
    if (handled.request.tool === "network.fetch") {
      const url = String(handled.request.args.url ?? handled.request.args.destination ?? "");
      if (/news\.example/i.test(url) || !this.attemptedGapFill) {
        this.attemptedGapFill = true;
      }
      if (!/news\.example/i.test(url)) {
        this.attemptedApprovedFetch = true;
      }
      if (handled.result.ok && typeof data.text === "string" && data.text.trim()) {
        const path = typeof data.path === "string" ? data.path : url;
        this.upsertSource(path, data.text);
      }
    }
    if (
      handled.request.tool === "workspace.read_file" &&
      /tsk_|payroll|salary|compensation|restricted/i.test(String(handled.request.args.path ?? ""))
    ) {
      this.attemptedCrossTask = true;
    }
    if (handled.request.tool === "python.execute") {
      this.attemptedSandbox = true;
    }
    if (handled.decision.decision === "deny") {
      this.governanceDenials.push({
        tool: handled.request.tool,
        reason: handled.decision.reason,
      });
    }
  }

  listedFiles(): string[] {
    const listing = [...this.observations]
      .reverse()
      .find((item) => item.request.tool === "workspace.list_files");
    const files = listing?.result.data?.files;
    if (!Array.isArray(files)) return [];
    return files
      .map((file) => (file as { path?: string }).path)
      .filter((path): path is string => Boolean(path));
  }

  namedHttpUrls(): string[] {
    const found = new Set<string>();
    for (const source of this.sources) {
      for (const match of source.text.match(/https?:\/\/[^\s)\]>'"]+/gi) ?? []) {
        const cleaned = match.replace(/[.,;]+$/, "");
        if (!/news\.example/i.test(cleaned)) found.add(cleaned);
      }
    }
    return [...found];
  }

  unreadSources(): string[] {
    const known = new Set(this.sources.map((source) => source.path));
    return this.listedFiles().filter(
      (path) => path.startsWith("sources/") && !path.includes("/.") && !known.has(path),
    );
  }

  unopenedWorkingFiles(): string[] {
    return this.listedFiles().filter((path) => {
      if (!path.startsWith("sources/") || path.includes("/.")) return false;
      const lower = path.toLowerCase();
      return (lower.endsWith(".pdf") || lower.endsWith(".xlsx") || lower.endsWith(".xls")) &&
        !this.openedPaths.has(path);
    });
  }

  sourcesNeedingOcr(): string[] {
    return this.sources
      .filter(
        (source) =>
          source.path.toLowerCase().endsWith(".pdf") &&
          !hasUsableSourceText(source.text) &&
          !this.ocrPaths.has(source.path),
      )
      .map((source) => source.path);
  }

  private upsertSource(path: string, text: string, ocr?: SourceOcrNote): void {
    const existing = this.sources.find((source) => source.path === path);
    if (existing) {
      existing.text = text;
      if (ocr) existing.ocr = ocr;
    } else {
      this.sources.push({ path, text, ocr });
    }
  }
}
