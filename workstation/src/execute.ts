import type {
  ActionRequest,
  ActionResult,
  ExecutionGrant,
  GrantVerifier,
} from "@aether/contracts";
import type { TaskEnvironment } from "./isolation";
import { defaultAdapters, substrateFor, type SubstrateAdapter } from "./substrates";
import { readSpreadsheetSummary } from "./spreadsheets";
import type { TaskWorkspace } from "./workspace";

function fail(error: string): ActionResult {
  return { ok: false, status: "failed", error };
}

/**
 * Unified controlled execution. Refuses work unless the control plane issued
 * a grant. Routes WHAT through a substrate adapter; adapters choose HOW.
 */
export class Workstation {
  private readonly adapters: SubstrateAdapter[];

  constructor(
    private readonly workspace: TaskWorkspace,
    private readonly grants: GrantVerifier,
    readonly environment?: TaskEnvironment,
    adapters: SubstrateAdapter[] = defaultAdapters(),
  ) {
    this.adapters = adapters;
  }

  async execute(request: ActionRequest, grant: ExecutionGrant): Promise<ActionResult> {
    if (!this.grants.verify(grant, request)) {
      return fail("Refusing execution without a valid control-plane grant.");
    }
    this.grants.consume(grant.grantId);

    const adapter = this.adapters.find((item) => item.handles(request.tool));
    if (!adapter) {
      return fail(`No substrate adapter is registered for ${request.tool}.`);
    }

    try {
      const result = await adapter.execute(request, {
        workspace: this.workspace,
        isolation: this.environment,
      });
      return {
        ...result,
        data: {
          ...(result.data ?? {}),
          substrate: adapter.substrate,
          routedAs: substrateFor(request.tool),
        },
      };
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  inspectSpreadsheet(relativePath: string) {
    return readSpreadsheetSummary(this.workspace, relativePath);
  }
}
