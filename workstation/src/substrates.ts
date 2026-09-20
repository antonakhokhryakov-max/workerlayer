import type {
  ActionName,
  ActionRequest,
  ActionResult,
  ExecutionSubstrate,
  KnownActionName,
} from "@aether/contracts";
import { executeDirectTool } from "./direct-tools";
import type { TaskEnvironment } from "./isolation";
import { executePythonSandbox } from "./sandbox";
import { fetchApprovedDestination } from "./web";
import type { TaskWorkspace } from "./workspace";

export interface ExecutionContext {
  workspace: TaskWorkspace;
  isolation?: TaskEnvironment;
}

export interface SubstrateAdapter {
  readonly substrate: ExecutionSubstrate;
  handles(tool: ActionName): boolean;
  execute(request: ActionRequest, ctx: ExecutionContext): Promise<ActionResult>;
}

export const SUBSTRATE_FOR_TOOL: Record<KnownActionName, ExecutionSubstrate> = {
  "workspace.list_files": "DIRECT_TOOL",
  "workspace.read_file": "DIRECT_TOOL",
  "workspace.ingest_sources": "DIRECT_TOOL",
  "pdf.extract_text": "DIRECT_TOOL",
  "pdf.open": "DIRECT_TOOL",
  "pdf.ocr": "DIRECT_TOOL",
  "spreadsheet.open": "DIRECT_TOOL",
  "research.review_sources": "DIRECT_TOOL",
  "analysis.record_findings": "DIRECT_TOOL",
  "spreadsheet.create": "DIRECT_TOOL",
  "spreadsheet.update": "DIRECT_TOOL",
  "presentation.create": "DIRECT_TOOL",
  "document.create": "DIRECT_TOOL",
  "artifact.inspect": "DIRECT_TOOL",
  "quality.check": "DIRECT_TOOL",
  "artifact.validate": "DIRECT_TOOL",
  "export.send_external": "DIRECT_TOOL",
  "network.fetch": "BROWSER",
  "python.execute": "SANDBOX",
  "claims.read": "DIRECT_TOOL",
  "claims.update": "DIRECT_TOOL",
  "claims.pay": "DIRECT_TOOL",
  "unrelated.data": "DIRECT_TOOL",
};

export function substrateFor(tool: ActionName): ExecutionSubstrate {
  if (tool === "python.execute") return "SANDBOX";
  if (tool === "network.fetch") return "BROWSER";
  return SUBSTRATE_FOR_TOOL[tool as KnownActionName] ?? "DIRECT_TOOL";
}

export class DirectToolAdapter implements SubstrateAdapter {
  readonly substrate = "DIRECT_TOOL" as const;
  handles(tool: ActionName): boolean {
    return substrateFor(tool) === "DIRECT_TOOL";
  }
  execute(request: ActionRequest, ctx: ExecutionContext): Promise<ActionResult> {
    return executeDirectTool(request, ctx);
  }
}

export class SandboxAdapter implements SubstrateAdapter {
  readonly substrate = "SANDBOX" as const;
  handles(tool: ActionName): boolean {
    return tool === "python.execute";
  }
  async execute(request: ActionRequest, ctx: ExecutionContext): Promise<ActionResult> {
    const source = typeof request.args.source === "string" ? request.args.source : "";
    const runner = ctx.isolation?.spawn;
    if (!runner) {
      return { ok: false, status: "failed", error: "Sandbox python needs a task environment." };
    }
    return executePythonSandbox(ctx.workspace, source, runner);
  }
}

/**
 * Allowlisted fetch adapter. Routed as BROWSER because that is the product slot.
 * It is not a real browser — only assignment-approved destinations.
 */
export class AllowlistFetchAdapter implements SubstrateAdapter {
  readonly substrate = "BROWSER" as const;
  handles(tool: ActionName): boolean {
    return tool === "network.fetch";
  }
  async execute(request: ActionRequest, ctx: ExecutionContext): Promise<ActionResult> {
    const url = String(request.args.url ?? request.args.destination ?? "");
    const fetched = fetchApprovedDestination(ctx.workspace, url, ctx.isolation?.spawn);
    return { ok: true, status: "succeeded", data: { ...fetched } };
  }
}

export function defaultAdapters(): SubstrateAdapter[] {
  return [new DirectToolAdapter(), new SandboxAdapter(), new AllowlistFetchAdapter()];
}
