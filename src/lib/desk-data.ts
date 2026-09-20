import type {
  ApprovalTicket,
  AuditEvent,
  CapabilityManifest,
  GrantReviewRecord,
  WorkerRecord,
} from "@aether/contracts";
import {
  summarizeEffort,
  type PackEffortRow,
  type StoredTask,
} from "@aether/runtime";
import { loadHostVerticals } from "@/lib/load-host-verticals";
import { hostUrl, isControlSurface } from "@/lib/host-mode";
import { loadTaskPreviews, type SlidePreview } from "@/lib/previews";
import { getStore } from "@/lib/server";

export type DeskHomeState =
  | {
      kind: "host";
      workers: WorkerRecord[];
      recent: StoredTask[];
      audits: Record<string, AuditEvent[]>;
      effort: PackEffortRow[];
    }
  | { kind: "missing-host" };

export type DeskTaskPreviews = {
  markdown?: string;
  slides?: { title?: string; slides: SlidePreview[] };
};

export type DeskTaskState =
  | { kind: "missing-host" }
  | { kind: "missing-task" }
  | {
      kind: "host";
      task: StoredTask;
      audit: AuditEvent[];
      approvals: ApprovalTicket[];
      sources: Array<{ name: string; bytes: number }>;
      worker?: WorkerRecord;
      manifest?: CapabilityManifest;
      grantReview?: GrantReviewRecord;
      previews: DeskTaskPreviews;
    };

async function fetchHost<T>(path: string): Promise<{ ok: true; body: T } | { ok: false; status: number }> {
  const host = hostUrl();
  if (!host) return { ok: false, status: 503 };
  const res = await fetch(`${host}${path}`, { cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, body: (await res.json()) as T };
}

export async function loadDeskHome(): Promise<DeskHomeState> {
  if (isControlSurface()) {
    const result = await fetchHost<Extract<DeskHomeState, { kind: "host" }>>("/api/desk/home");
    if (!result.ok) return { kind: "missing-host" };
    return { ...result.body, kind: "host" };
  }

  await loadHostVerticals();
  const store = getStore();
  const all = store.list();
  const workers = store.listWorkers().filter((item) => item.kind === "echo_clerk");
  const recent = all.slice(0, 6);
  const audits: Record<string, AuditEvent[]> = {};
  for (const task of recent) {
    audits[task.brief.id] = store.readAudit(task.brief.id);
  }
  return {
    kind: "host",
    workers,
    recent,
    audits,
    effort: summarizeEffort(all),
  };
}

export async function loadDeskTask(id: string): Promise<DeskTaskState> {
  if (isControlSurface()) {
    const result = await fetchHost<Extract<DeskTaskState, { kind: "host" }>>(
      `/api/desk/tasks/${encodeURIComponent(id)}`,
    );
    if (!result.ok) {
      return result.status === 404 ? { kind: "missing-task" } : { kind: "missing-host" };
    }
    return { ...result.body, kind: "host" };
  }

  await loadHostVerticals();
  const store = getStore();
  const task = store.get(id);
  if (!task) return { kind: "missing-task" };
  const worker = task.brief.workerId ? store.getWorker(task.brief.workerId) : undefined;
  const manifest = task.brief.capabilityManifestId
    ? store.getManifest(task.brief.capabilityManifestId)
    : undefined;
  const grantReview = task.brief.environmentId
    ? store.getEnvironment(task.brief.environmentId)?.grantReview
    : undefined;
  return {
    kind: "host",
    task,
    audit: store.readAudit(id),
    approvals: store.loadApprovals(id),
    sources: store.listSources(id),
    worker,
    manifest,
    grantReview,
    previews: loadTaskPreviews(store, id, task.artifacts),
  };
}
