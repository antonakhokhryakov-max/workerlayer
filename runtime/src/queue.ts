import type { TaskBrief } from "@aether/contracts";
import { AetherPlatform } from "./platform";
import { bindBriefToWorker } from "./workers";
import { emptyReview, TaskStore, type StoredTask } from "./store";
import type { RunOptions, RunResult } from "./kernel";

export function saveQueuedTask(brief: TaskBrief, store = new TaskStore()): StoredTask {
  bindBriefToWorker(store, brief);
  store.workspaceRoot(brief.id);
  store.sealOriginals(brief.id);
  const task: StoredTask = {
    brief,
    status: "queued",
    findings: [],
    artifacts: [],
    review: emptyReview(),
    modelProvider: "pending",
  };
  store.save(task);
  return task;
}

export function startQueuedTask(
  taskId: string,
  store = new TaskStore(),
  options: Omit<RunOptions, "store" | "isolatePlanner"> = {},
): { started: boolean; reason?: string } {
  return new AetherPlatform(store).startTask(taskId, options);
}

export async function runQueuedTaskNow(
  taskId: string,
  store = new TaskStore(),
  options: Omit<RunOptions, "store" | "isolatePlanner"> = {},
): Promise<RunResult> {
  return new AetherPlatform(store).runTask(taskId, options);
}
