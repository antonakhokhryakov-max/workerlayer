import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RegisteredTool, WorkerKind, WorkerRecord } from "@aether/contracts";
import { bindBriefToWorker, ensurePersistentWorker } from "./workers";
import { newBrief, runRegisteredTask, type RunOptions, type RunResult } from "./kernel";
import { emptyReview, type StoredTask, TaskStore } from "./store";

/**
 * Public platform surface. Harbor, Claims, and registered verticals use this.
 * No private shortcut around Worker → Task → CapabilityManifest → WorkerEnvironment.
 * Which planner runs is a registry lookup, not a kind switch.
 */
export class AetherPlatform {
  constructor(private readonly store: TaskStore) {}

  ensureWorker(kind: WorkerKind = "knowledge"): WorkerRecord {
    return ensurePersistentWorker(this.store, kind);
  }

  getWorker(workerId: string): WorkerRecord | undefined {
    return this.store.getWorker(workerId);
  }

  createTask(
    workerId: string,
    input: {
      goal: string;
      files?: Array<{ name: string; absolutePath: string }>;
      fileContents?: Array<{ name: string; bytes: Buffer | Uint8Array | string }>;
      approvedDestinations?: string[];
      sourceFiles?: Array<{ name: string; relativePath: string }>;
      registeredTools?: RegisteredTool[];
      developerGranted?: string[];
      developerDenied?: string[];
      developerRequireApproval?: string[];
    },
  ): StoredTask {
    const worker = this.store.getWorker(workerId);
    if (!worker) throw new Error(`Unknown worker ${workerId}`);
    const names = [
      ...(input.files ?? []).map((file) => file.name),
      ...(input.fileContents ?? []).map((file) => file.name),
      ...(input.sourceFiles ?? []).map((file) => file.name),
    ];
    const uniqueNames = [...new Set(names)];
    const sourceFiles =
      input.sourceFiles ?? uniqueNames.map((name) => ({ name, relativePath: `sources/${name}` }));
    const brief: TaskBrief = bindBriefToWorker(
      this.store,
      newBrief(input.goal, sourceFiles, {
        workerKind: worker.kind,
        workerId: worker.id,
        approvedDestinations: input.approvedDestinations,
        registeredTools: input.registeredTools,
        developerGranted: input.developerGranted,
        developerDenied: input.developerDenied,
        developerRequireApproval: input.developerRequireApproval,
      }),
    );
    const workspace = this.store.workspaceRoot(brief.id);
    mkdirSync(join(workspace, "sources"), { recursive: true });
    for (const file of input.files ?? []) {
      copyFileSync(file.absolutePath, join(workspace, "sources", file.name));
    }
    for (const file of input.fileContents ?? []) {
      writeFileSync(join(workspace, "sources", file.name), file.bytes);
    }
    this.store.sealOriginals(brief.id);
    const task: StoredTask = {
      brief,
      status: "queued",
      findings: [],
      artifacts: [],
      review: emptyReview(),
      modelProvider: "pending",
    };
    this.store.save(task);
    return task;
  }

  async runTask(
    taskId: string,
    options: Omit<RunOptions, "store" | "isolatePlanner"> = {},
  ): Promise<RunResult> {
    const task = this.store.get(taskId);
    if (!task) throw new Error(`Unknown task ${taskId}`);
    bindBriefToWorker(this.store, task.brief);
    this.store.save(task);
    return runRegisteredTask(task.brief, { ...options, store: this.store, isolatePlanner: true });
  }

  getTask(taskId: string): StoredTask | undefined {
    return this.store.get(taskId);
  }

  getManifest(manifestId: string) {
    return this.store.getManifest(manifestId);
  }

  getAudit(taskId: string) {
    return this.store.readAudit(taskId);
  }

  /**
   * Fire-and-forget run for the assignment desk. Same public runTask path.
   */
  startTask(
    taskId: string,
    options: Omit<RunOptions, "store" | "isolatePlanner"> = {},
  ): { started: boolean; reason?: string } {
    const task = this.store.get(taskId);
    if (!task) return { started: false, reason: "Unknown task." };
    if (task.status === "running") return { started: false, reason: "Already running." };
    if (task.status === "completed") return { started: false, reason: "Already completed." };
    if (inFlight.has(taskId)) return { started: false, reason: "Already starting." };
    inFlight.add(taskId);
    task.status = "running";
    this.store.save(task);
    void this.runTask(taskId, options).finally(() => {
      inFlight.delete(taskId);
    });
    return { started: true };
  }
}

const inFlight = new Set<string>();

export function platform(store = new TaskStore()): AetherPlatform {
  return new AetherPlatform(store);
}
