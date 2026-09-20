import type {
  CapabilityManifest,
  TaskBrief,
  TaskCapabilities,
  WorkerKind,
  WorkerRecord,
} from "@aether/contracts";
import { nowIso } from "@aether/contracts";
import "./builtins";
import { requireWorkerRegistration } from "./registry";
import type { TaskStore } from "./store";

export function persistentWorkerId(kind: WorkerKind): string {
  return `wkr_${kind}`;
}

export function defaultManifestId(kind: WorkerKind): string {
  return `cmf_${kind}`;
}

export function capabilitiesFromBrief(brief: TaskBrief, workspaceRoot: string): TaskCapabilities {
  const kind = brief.workerKind ?? "knowledge";
  return requireWorkerRegistration(kind).capabilities(brief, workspaceRoot);
}

export function manifestFromCapabilities(
  workerId: string,
  manifestId: string,
  capabilities: TaskCapabilities,
): CapabilityManifest {
  return {
    id: manifestId,
    workerId,
    granted: [...capabilities.granted],
    denied: [...capabilities.denied],
    requireApproval: [...capabilities.requireApproval],
    approvedDestinations: [...capabilities.networkAllowlist],
    registeredTools: capabilities.registeredTools,
    compiledFrom: "declared",
  };
}

/**
 * Persistent Worker. One per kind in this Alpha — not an account system.
 * Tasks hang off it; each Task still gets its own identity and WorkerEnvironment.
 * Kind must already be registered.
 */
export function ensurePersistentWorker(store: TaskStore, kind: WorkerKind = "knowledge"): WorkerRecord {
  const registration = requireWorkerRegistration(kind);
  const id = persistentWorkerId(kind);
  const existing = store.getWorker(id);
  if (existing) return existing;
  const capabilities = capabilitiesFromBrief({ workerKind: kind } as TaskBrief, "seed");
  const manifest = manifestFromCapabilities(id, defaultManifestId(kind), capabilities);
  const worker: WorkerRecord = {
    id,
    name: registration.name,
    kind,
    status: "active",
    capabilityManifestId: manifest.id,
    createdAt: nowIso(),
    taskIds: [],
  };
  store.saveManifest(manifest);
  store.saveWorker(worker);
  return worker;
}

/**
 * Bind a Task onto its persistent Worker and snapshot a CapabilityManifest for this assignment.
 * Destination allowlists and developer overlays live on the snapshot, not on the Worker itself.
 */
export function bindBriefToWorker(store: TaskStore, brief: TaskBrief): TaskBrief {
  const kind = brief.workerKind ?? "knowledge";
  const worker = ensurePersistentWorker(store, kind);
  if (!worker.taskIds.includes(brief.id)) {
    worker.taskIds = [...worker.taskIds, brief.id];
    store.saveWorker(worker);
  }
  const capabilities = capabilitiesFromBrief(brief, store.workspaceRoot(brief.id));
  const snapshot: CapabilityManifest = {
    id: brief.capabilityManifestId ?? `${defaultManifestId(kind)}_${brief.id.slice(-8)}`,
    workerId: worker.id,
    granted: brief.developerGranted ?? [...capabilities.granted],
    denied: brief.developerDenied ?? [...capabilities.denied],
    requireApproval: brief.developerRequireApproval ?? [...capabilities.requireApproval],
    approvedDestinations: brief.approvedDestinations ?? [...capabilities.networkAllowlist],
    registeredTools: brief.registeredTools ?? capabilities.registeredTools,
    compiledFrom: "declared",
  };
  store.saveManifest(snapshot);
  brief.workerId = worker.id;
  brief.workerKind = kind;
  brief.capabilityManifestId = snapshot.id;
  return brief;
}

export function capabilitiesFromManifest(
  store: TaskStore,
  brief: TaskBrief,
  workspaceRoot: string,
): TaskCapabilities {
  const base = capabilitiesFromBrief(brief, workspaceRoot);
  const manifest = brief.capabilityManifestId
    ? store.getManifest(brief.capabilityManifestId)
    : undefined;
  if (!manifest) return base;
  return {
    ...base,
    granted: [...manifest.granted],
    denied: [...manifest.denied],
    requireApproval: [...manifest.requireApproval],
    networkAllowlist: [...manifest.approvedDestinations],
    registeredTools: manifest.registeredTools,
  };
}
