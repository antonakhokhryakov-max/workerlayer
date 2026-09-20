import type { ActionRequest, ActionResult, ArtifactKind } from "@aether/contracts";
import { ocrPdf } from "./ocr";
import { extractPdfText, openPdf } from "./pdfs";
import { readWorkspaceFile } from "./files";
import { createDocument } from "./documents";
import { ingestAttachedSources } from "./ingest";
import { createPresentation, type SlideSpec } from "./presentations";
import { checkQuality, inspectArtifacts } from "./quality";
import { reviewAttachedSources } from "./research";
import { createSpreadsheet, openSpreadsheet, type SheetSpec } from "./spreadsheets";
import { validateArtifact } from "./validation";
import { executeClaimsPay, executeClaimsRead, executeClaimsUpdate } from "./claims";
import type { ExecutionContext } from "./substrates";

function fail(error: string): ActionResult {
  return { ok: false, status: "failed", error };
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asSlides(value: unknown): SlideSpec[] {
  if (!Array.isArray(value)) return [];
  return value.map((slide) => {
    const record = slide as { title?: unknown; bullets?: unknown; footer?: unknown };
    return {
      title: asString(record.title, "Slide"),
      bullets: Array.isArray(record.bullets)
        ? record.bullets.map((bullet) => String(bullet ?? ""))
        : [],
      footer: typeof record.footer === "string" ? record.footer : undefined,
    };
  });
}

function asSheets(value: unknown): SheetSpec[] {
  if (!Array.isArray(value)) return [];
  return value.map((sheet) => {
    const record = sheet as { name?: unknown; rows?: unknown };
    const rows = Array.isArray(record.rows)
      ? record.rows.map((row) =>
          Array.isArray(row)
            ? row.map((cell) => {
                if (typeof cell === "number") return cell;
                if (cell === null) return null;
                return String(cell ?? "");
              })
            : [],
        )
      : [];
    return { name: asString(record.name, "Sheet"), rows };
  });
}

/** DIRECT_TOOL adapter — first-party tools that run in-process against the task workspace. */
export async function executeDirectTool(
  request: ActionRequest,
  ctx: ExecutionContext,
): Promise<ActionResult> {
  const workspace = ctx.workspace;
  switch (request.tool) {
    case "workspace.list_files": {
      const files = workspace.listFiles();
      return { ok: true, status: "succeeded", data: { files } };
    }
    case "workspace.read_file": {
      const path = asString(request.args.path);
      const file = readWorkspaceFile(workspace, path);
      return { ok: true, status: "succeeded", data: file };
    }
    case "pdf.extract_text": {
      const path = asString(request.args.path);
      const extracted = await extractPdfText(workspace, path);
      return { ok: true, status: "succeeded", data: extracted };
    }
    case "pdf.open": {
      const path = asString(request.args.path);
      const opened = await openPdf(workspace, path);
      return { ok: true, status: "succeeded", data: opened };
    }
    case "pdf.ocr": {
      const path = asString(request.args.path);
      const ocr = await ocrPdf(workspace, path, ctx.isolation?.spawn);
      return { ok: true, status: "succeeded", data: { ...ocr } };
    }
    case "spreadsheet.open": {
      const path = asString(request.args.path);
      const opened = await openSpreadsheet(workspace, path);
      return { ok: true, status: "succeeded", data: opened };
    }
    case "workspace.ingest_sources": {
      const ingested = await ingestAttachedSources(workspace);
      return { ok: true, status: "succeeded", data: ingested };
    }
    case "research.review_sources": {
      const review = reviewAttachedSources(workspace);
      workspace.writeBytes("artifacts/research-notes.json", JSON.stringify(review, null, 2));
      return { ok: true, status: "succeeded", data: { review } };
    }
    case "analysis.record_findings": {
      const analysis = {
        company: asString(request.args.company) || undefined,
        summary: asString(request.args.summary) || undefined,
        findings: Array.isArray(request.args.findings) ? request.args.findings : [],
        citations: Array.isArray(request.args.citations) ? request.args.citations : [],
        uncertainties: Array.isArray(request.args.uncertainties) ? request.args.uncertainties : [],
        companies: Array.isArray(request.args.companies) ? request.args.companies : [],
      };
      workspace.writeBytes("findings.json", JSON.stringify(analysis, null, 2));
      return { ok: true, status: "succeeded", data: { analysis } };
    }
    case "spreadsheet.create":
    case "spreadsheet.update": {
      const filename = asString(request.args.filename, "findings.xlsx");
      const title = asString(request.args.title, "Knowledge-work findings");
      const created = await createSpreadsheet(workspace, filename, title, asSheets(request.args.sheets));
      return {
        ok: true,
        status: "succeeded",
        data: { ...created, kind: "spreadsheet", title },
      };
    }
    case "presentation.create": {
      const created = await createPresentation(
        workspace,
        asString(request.args.filename, "briefing.pptx"),
        asString(request.args.title, "Knowledge-work briefing"),
        asSlides(request.args.slides),
      );
      return { ok: true, status: "succeeded", data: created };
    }
    case "document.create": {
      const created = createDocument(
        workspace,
        asString(request.args.filename, "summary.md"),
        asString(request.args.title, "One-page summary"),
        asString(request.args.markdown),
      );
      return { ok: true, status: "succeeded", data: created };
    }
    case "artifact.inspect": {
      const inspection = await inspectArtifacts(workspace);
      return { ok: true, status: "succeeded", data: inspection };
    }
    case "quality.check": {
      const requested = request.args.requestedSlides;
      const report = await checkQuality(workspace, typeof requested === "number" ? requested : undefined);
      return { ok: true, status: "succeeded", data: { report } };
    }
    case "artifact.validate": {
      const path = asString(request.args.path) || `artifacts/${asString(request.args.filename)}`;
      const kindArg = asString(request.args.kind);
      const report = await validateArtifact(
        workspace,
        path,
        kindArg ? (kindArg as ArtifactKind) : undefined,
      );
      return {
        ok: report.valid,
        status: report.valid ? "succeeded" : "failed",
        data: { ...report },
      };
    }
    case "claims.read":
      return executeClaimsRead(workspace);
    case "claims.update":
      return executeClaimsUpdate(workspace, request.args);
    case "claims.pay":
      return executeClaimsPay(workspace, request.args);
    case "unrelated.data":
      return fail("unrelated.data is not implemented. Policy should have denied this request.");
    case "export.send_external": {
      return {
        ok: true,
        status: "succeeded",
        data: {
          simulated: true,
          message: "External send is approved but not transmitted in this prototype.",
          destination: request.args.destination ?? request.args.url ?? request.args.to,
        },
      };
    }
    default:
      return executeRegisteredDirectTool(request, workspace);
  }
}

function executeRegisteredDirectTool(
  request: ActionRequest,
  workspace: ExecutionContext["workspace"],
): ActionResult {
  const rawPath =
    asString(request.args.path) || asString(request.args.filename) || asString(request.args.name);
  const text = asString(request.args.text) || asString(request.args.content) || undefined;
  if (text !== undefined && rawPath) {
    const nested = rawPath.replace(/^artifacts\//, "");
    const path = `artifacts/${nested}`;
    workspace.writeBytes(path, text);
    return {
      ok: true,
      status: "succeeded",
      data: { path, kind: "file", bytes: Buffer.byteLength(text), tool: request.tool },
    };
  }
  if (rawPath) {
    const candidates = rawPath.includes("/") ? [rawPath] : [rawPath, `sources/${rawPath}`, `artifacts/${rawPath}`];
    for (const candidate of candidates) {
      if (workspace.exists(candidate)) {
        const file = readWorkspaceFile(workspace, candidate);
        return { ok: true, status: "succeeded", data: { ...file, tool: request.tool } };
      }
    }
    return fail(`File '${rawPath}' is not in this task environment.`);
  }
  return {
    ok: true,
    status: "succeeded",
    data: { echoed: request.args, tool: request.tool },
  };
}
