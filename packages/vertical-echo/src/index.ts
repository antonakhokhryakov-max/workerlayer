import { developerWorkerCapabilities } from "@aether/control-plane";
import type { ActionRequest, AgentIntent, HandledAction, TaskBrief, WorkPlan } from "@aether/contracts";
import { id } from "@aether/contracts";
import { registerWorker, type VerticalPlanner } from "@aether/runtime";

/**
 * Example third-party vertical. Lives in its own package.
 * Does not authorize. Does not provision environments. Not listed in builtins.ts.
 */
export const ECHO_KIND = "echo_clerk";

export const ECHO_GOAL =
  "Echo the attached line. Do not read secrets or payroll.";

export const ECHO_TOOLS = [
  { name: "echo.write", capability: "echo:write", policy: "allow" as const },
];

export class EchoClerk implements VerticalPlanner {
  wrote = false;
  deniedSensitive = false;
  planState?: WorkPlan;

  plan(task: TaskBrief): WorkPlan {
    this.planState = {
      summary: `Echo clerk on ${task.goal}`,
      steps: [
        { id: "write", title: "Write the echo", detail: "Request echo.write.", status: "pending" },
        {
          id: "secrets",
          title: "Refuse secrets",
          detail: "Request echo.secrets so policy can deny it.",
          status: "pending",
        },
      ],
    };
    return this.planState;
  }

  observe(handled: HandledAction): void {
    if (handled.request.tool === "echo.write" && handled.result.ok) {
      this.wrote = true;
      this.mark("write", "done");
    }
    if (handled.request.tool === "echo.secrets" && handled.decision.decision === "deny") {
      this.deniedSensitive = true;
      this.mark("secrets", "done");
    }
  }

  async nextIntent(task: TaskBrief): Promise<AgentIntent> {
    const request = (
      tool: string,
      args: Record<string, unknown>,
      rationale: string,
    ): ActionRequest => ({
      id: id("req"),
      taskId: task.id,
      tool,
      args,
      requestedBy: "agent",
      rationale,
    });

    if (!this.wrote) {
      const note = task.sourceFiles[0]?.name ?? "note.md";
      return {
        type: "request",
        request: request(
          "echo.write",
          {
            path: "echo.md",
            text: `# Echo\n\nHeard ${note}. hello from a packaged vertical.\n`,
          },
          "Write an echo artifact using a registered tool.",
        ),
      };
    }
    if (!this.deniedSensitive) {
      return {
        type: "request",
        request: request("echo.secrets", { path: "secrets.csv" }, "Pull secrets for the echo."),
      };
    }
    return { type: "finish", summary: "Echoed the note. Secrets were denied." };
  }

  applyToTask(task: { company?: string; summary?: string; plan?: WorkPlan }): void {
    task.company = "Echo clerk";
    task.summary = "Echoed the note. Secrets were denied.";
    task.plan = this.planState;
  }

  isDelivered(): boolean {
    return this.wrote && this.deniedSensitive;
  }

  private mark(id: string, status: WorkPlan["steps"][number]["status"]): void {
    if (!this.planState) return;
    this.planState = {
      ...this.planState,
      steps: this.planState.steps.map((step) => (step.id === id ? { ...step, status } : step)),
    };
  }
}

/** Host calls this after dynamic import. Idempotent. */
export function register(): void {
  registerWorker({
    kind: ECHO_KIND,
    name: "Echo clerk",
    pack: "other",
    modelName: "echo-clerk",
    defaultGoal: ECHO_GOAL,
    defaultTools: ECHO_TOOLS,
    statusWhileRunning:
      "The echo clerk is requesting tools. The control plane decides. You do not prompt it.",
    capabilities: (brief, workspaceRoot) => developerWorkerCapabilities(workspaceRoot, brief),
    createPlanner: () => new EchoClerk(),
  });
}
