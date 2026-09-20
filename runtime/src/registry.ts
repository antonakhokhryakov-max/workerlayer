import type { ModelProvider } from "@aether/agent";
import type {
  AgentIntent,
  FixTarget,
  HandledAction,
  RegisteredTool,
  TaskBrief,
  TaskCapabilities,
  WorkPlan,
  WorkerKind,
} from "@aether/contracts";
import type { StoredTask } from "./store";

/**
 * Planner a vertical registers. Untrusted. Requests tools. Does not authorize.
 * Does not provision environments.
 */
export interface VerticalPlanner {
  plan(brief: TaskBrief): WorkPlan | Promise<WorkPlan>;
  nextIntent(brief: TaskBrief): Promise<AgentIntent>;
  observe(handled: HandledAction): void | Promise<void>;
  applyToTask(task: StoredTask): void;
  isDelivered(): boolean;
  /** Resume after review. Knowledge-work hydrates memory. Others may omit it. */
  hydrate?(task: StoredTask): void | Promise<void>;
  /** One structured fix pass. Knowledge-work implements this. Others may omit it. */
  beginFix?(target: FixTarget): void | Promise<void>;
}

export interface PlannerContext {
  model?: ModelProvider;
}

export interface WorkerRegistration {
  kind: WorkerKind;
  name: string;
  /** Shown while the Task is running on the desk. */
  statusWhileRunning?: string;
  /** Effort-board pack. Knowledge-work packs (Harbor, diligence, market) stay heuristic. */
  pack?: "claims" | "staff" | "other";
  modelName?: string;
  /** Optional defaults so a host can run the vertical after loadVerticals without importing it. */
  defaultGoal?: string;
  defaultTools?: RegisteredTool[];
  capabilities: (brief: TaskBrief, workspaceRoot: string) => TaskCapabilities;
  createPlanner: (ctx: PlannerContext) => VerticalPlanner;
}

const registry = new Map<string, WorkerRegistration>();

/** Last write wins. A vertical calls this at process start — not a compiler. */
export function registerWorker(registration: WorkerRegistration): void {
  if (!registration.kind?.trim()) {
    throw new Error("registerWorker requires a WorkerKind.");
  }
  registry.set(registration.kind, registration);
}

export function unregisterWorker(kind: WorkerKind): void {
  registry.delete(kind);
}

export function getWorkerRegistration(kind: WorkerKind | undefined): WorkerRegistration | undefined {
  return registry.get(kind ?? "knowledge");
}

export function requireWorkerRegistration(kind: WorkerKind | undefined): WorkerRegistration {
  const found = getWorkerRegistration(kind);
  if (!found) {
    throw new Error(
      `No worker registered for kind '${kind ?? "knowledge"}'. Call registerWorker({ kind, createPlanner, capabilities }) first.`,
    );
  }
  return found;
}

export function registeredWorkerKinds(): WorkerKind[] {
  return [...registry.keys()];
}

export function workerDisplayName(kind: WorkerKind | undefined): string {
  return getWorkerRegistration(kind)?.name ?? "Knowledge-work result";
}

export function workerRunningMessage(kind: WorkerKind | undefined): string {
  return (
    getWorkerRegistration(kind)?.statusWhileRunning ??
    "The worker is requesting tools. The control plane decides. You do not prompt it."
  );
}
