import { fork, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AgentIntent, FixTarget, HandledAction, TaskBrief, WorkPlan } from "@aether/contracts";
import type { StoredTask } from "./store";
import { SNAPSHOT_KEYS, type PlannerChildMessage, type PlannerParentMessage, type PlannerSnapshot } from "./planner-protocol";
import { sanitizePlannerIntent } from "./sanitize-intent";
import type { VerticalPlanner } from "./registry";

export function plannerHostPath(root = process.cwd()): string {
  const path = join(root, "runtime/src/planner-host.ts");
  if (!existsSync(path)) {
    throw new Error(`Planner host script missing at ${path}.`);
  }
  return path;
}

/** Resolve tsx from disk. Do not require.resolve — Next traces that into esbuild. */
function tsxImport(root = process.cwd()): string {
  const candidates = [
    join(root, "node_modules/tsx/dist/loader.mjs"),
    join(root, "node_modules/tsx/dist/esm/index.mjs"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "tsx";
}

export interface IsolatedPlannerStartOptions {
  root?: string;
  /** When the parent used DeterministicProvider, the child uses the same path. */
  modelKind?: "deterministic" | "llm";
}

/**
 * Parent-side proxy. The planner lives in a child process.
 * This object never executes tools and never issues grants.
 */
export class IsolatedPlanner implements VerticalPlanner {
  private nextId = 1;
  private stopped = false;
  private pending = new Map<
    number,
    { resolve: (value: PlannerChildMessage) => void; reject: (error: Error) => void }
  >();
  private snapshot: PlannerSnapshot = {};
  private delivered = false;
  readonly pid: number;

  private constructor(private readonly child: ChildProcess) {
    this.pid = child.pid ?? -1;
    child.on("message", (raw: PlannerChildMessage) => {
      const wait = this.pending.get(raw.id);
      if (!wait) return;
      this.pending.delete(raw.id);
      if ("error" in raw && raw.error) wait.reject(new Error(raw.error));
      else wait.resolve(raw);
    });
    child.on("exit", (code) => {
      for (const [id, wait] of this.pending) {
        this.pending.delete(id);
        wait.reject(new Error(`Planner process exited (${code ?? "unknown"}).`));
      }
    });
    child.on("error", (error) => {
      for (const [id, wait] of this.pending) {
        this.pending.delete(id);
        wait.reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  static async start(kind: string, options: IsolatedPlannerStartOptions = {}): Promise<IsolatedPlanner> {
    const root = options.root ?? process.cwd();
    const child = fork(plannerHostPath(root), [], {
      cwd: root,
      execArgv: ["--import", tsxImport(root)],
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      env: {
        ...process.env,
        AETHER_PLANNER_KIND: kind,
        ...(options.modelKind === "deterministic" ? { AETHER_PLANNER_MODEL: "deterministic" } : {}),
      },
    });
    const planner = new IsolatedPlanner(child);
    try {
      const ready = await planner.rpc({ op: "init", kind });
      if (!("ok" in ready) || !ready.ok) {
        throw new Error("Planner process failed to initialize.");
      }
      return planner;
    } catch (error) {
      await planner.stop();
      throw error;
    }
  }

  async plan(brief: TaskBrief): Promise<WorkPlan> {
    const reply = (await this.rpc({ op: "plan", brief })) as {
      plan: WorkPlan;
      snapshot: PlannerSnapshot;
      delivered: boolean;
    };
    this.snapshot = reply.snapshot;
    this.delivered = reply.delivered;
    return reply.plan;
  }

  async nextIntent(brief: TaskBrief): Promise<AgentIntent> {
    const reply = (await this.rpc({ op: "nextIntent", brief })) as {
      intent: AgentIntent;
      snapshot: PlannerSnapshot;
      delivered: boolean;
    };
    this.snapshot = reply.snapshot ?? this.snapshot;
    this.delivered = reply.delivered;
    return sanitizePlannerIntent(reply.intent);
  }

  async observe(handled: HandledAction): Promise<void> {
    const reply = (await this.rpc({ op: "observe", handled })) as {
      snapshot: PlannerSnapshot;
      delivered: boolean;
    };
    this.snapshot = reply.snapshot;
    this.delivered = reply.delivered;
  }

  async hydrate(task: StoredTask): Promise<void> {
    const snapshot: PlannerSnapshot = {};
    for (const key of SNAPSHOT_KEYS) {
      const value = task[key];
      if (value !== undefined) {
        (snapshot as Record<string, unknown>)[key] = value;
      }
    }
    const reply = (await this.rpc({
      op: "hydrate",
      snapshot,
      artifacts: task.artifacts,
    })) as { snapshot: PlannerSnapshot; delivered: boolean };
    this.snapshot = reply.snapshot;
    this.delivered = reply.delivered;
  }

  async beginFix(target: FixTarget): Promise<void> {
    const reply = (await this.rpc({ op: "beginFix", target })) as {
      snapshot: PlannerSnapshot;
      delivered: boolean;
    };
    this.snapshot = reply.snapshot;
    this.delivered = reply.delivered;
  }

  applyToTask(task: StoredTask): void {
    for (const key of SNAPSHOT_KEYS) {
      const value = this.snapshot[key];
      if (value !== undefined) {
        (task as Record<string, unknown>)[key] = value;
      }
    }
  }

  isDelivered(): boolean {
    return this.delivered;
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (!this.child.connected) {
      this.child.kill("SIGKILL");
      return;
    }
    try {
      this.child.send({ id: this.nextId++, op: "shutdown" } satisfies PlannerParentMessage);
    } catch {
      /* already gone */
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.child.kill("SIGKILL");
        resolve();
      }, 1500);
      this.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private rpc(
    payload: Omit<PlannerParentMessage, "id">,
  ): Promise<PlannerChildMessage> {
    const id = this.nextId++;
    const message = { id, ...payload } as PlannerParentMessage;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Planner process timed out on ${payload.op}.`));
      }, 120_000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      if (!this.child.send(message)) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error("Planner process IPC send failed."));
      }
    });
  }
}

/**
 * Kernel debug switch. Product surfaces must pass isolatePlanner: true.
 * AETHER_PLANNER_ISOLATE=0 only affects a direct kernel call that omitted the flag.
 */
export function plannerIsolationEnabled(options: { isolatePlanner?: boolean } = {}): boolean {
  if (options.isolatePlanner === true) return true;
  if (options.isolatePlanner === false) return false;
  if (process.env.AETHER_PLANNER_ISOLATE === "0") return false;
  return true;
}
