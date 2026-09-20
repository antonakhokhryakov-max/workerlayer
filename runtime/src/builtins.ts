import {
  developerWorkerCapabilities,
} from "@aether/control-plane";
import type { HandledAction, TaskBrief, WorkPlan } from "@aether/contracts";
import { getWorkerRegistration, registerWorker, type VerticalPlanner } from "./registry";
import type { StoredTask } from "./store";

function emptyDeclaredPlanner(): VerticalPlanner {
  return {
    plan: (brief: TaskBrief): WorkPlan => ({ summary: brief.goal, steps: [] }),
    nextIntent: async () => ({
      type: "finish",
      summary: "No declared requests. Use the developer API to send a request list.",
    }),
    observe: (_handled: HandledAction) => {},
    applyToTask: (_task: StoredTask) => {},
    isDelivered: () => true,
  };
}

/**
 * Only the /api/v1 developer worker is wired here.
 * Do not register Echo, Harbor, Claims, or any OEM vertical in this file.
 * Those load from aether.verticals.json via loadVerticals / loadHostVerticals.
 * See docs/OEM.md.
 */
export function ensureBuiltinWorkers(): void {
  if (getWorkerRegistration("developer")) return;

  registerWorker({
    kind: "developer",
    name: "Developer-declared worker",
    pack: "other",
    statusWhileRunning:
      "A developer-declared worker is requesting tools. The control plane decides. You do not prompt it.",
    capabilities: (brief, workspaceRoot) => developerWorkerCapabilities(workspaceRoot, brief),
    createPlanner: () => emptyDeclaredPlanner(),
  });
}

ensureBuiltinWorkers();
