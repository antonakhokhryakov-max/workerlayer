import { ChiefOfStaffWorker } from "@aether/agent";
import { developerWorkerCapabilities } from "@aether/control-plane";
import { registerWorker, type VerticalPlanner } from "@aether/runtime";

export const STAFF_KIND = "chief_of_staff";

function staffPlanner(): VerticalPlanner {
  const worker = new ChiefOfStaffWorker();
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
    isDelivered: () => worker.isDelivered(),
  };
}

/** Host calls this after loadVerticals / loadHostVerticals. Idempotent. */
export function register(): void {
  registerWorker({
    kind: STAFF_KIND,
    name: "North Dock chief of staff",
    pack: "staff",
    modelName: "north-dock-staff",
    statusWhileRunning:
      "The North Dock chief of staff is requesting tools. The control plane decides. You do not prompt it.",
    capabilities: (brief, workspaceRoot) => developerWorkerCapabilities(workspaceRoot, brief),
    createPlanner: () => staffPlanner(),
  });
}
