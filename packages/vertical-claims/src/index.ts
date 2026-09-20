import { ClaimsWorker } from "@aether/agent";
import { claimsWorkerCapabilities } from "@aether/control-plane";
import { registerWorker, type VerticalPlanner } from "@aether/runtime";

export const CLAIMS_KIND = "claims";

function claimsPlanner(): VerticalPlanner {
  const worker = new ClaimsWorker();
  return {
    plan: (brief) => worker.plan(brief),
    nextIntent: (brief) => worker.nextIntent(brief),
    observe: (handled) => worker.observe(handled),
    applyToTask: (task) => {
      task.plan = worker.planState;
      task.findings = worker.findings;
      task.company = worker.company;
      task.summary = worker.summary;
    },
    isDelivered: () => worker.read && worker.updated && worker.deniedUnrelated && worker.payRequested,
  };
}

/** Host calls this after loadVerticals / loadHostVerticals. Idempotent. */
export function register(): void {
  registerWorker({
    kind: CLAIMS_KIND,
    name: "Cedarline claims agent",
    pack: "claims",
    modelName: "cedarline-claims",
    statusWhileRunning:
      "The Cedarline claims agent is requesting tools. The control plane decides. You do not prompt it.",
    capabilities: (_brief, workspaceRoot) => claimsWorkerCapabilities(workspaceRoot),
    createPlanner: () => claimsPlanner(),
  });
}
