import type { StoredTask } from "./store";
import { getWorkerRegistration } from "./registry";

export type PackName = "harbor" | "diligence" | "market" | "approved" | "claims" | "staff" | "other";

const PACKS = new Set<PackName>([
  "harbor",
  "diligence",
  "market",
  "approved",
  "claims",
  "staff",
  "other",
]);

export function packName(task: StoredTask): PackName {
  const registered = getWorkerRegistration(task.brief.workerKind)?.pack;
  if (registered && PACKS.has(registered)) return registered;
  const blob = [
    task.company ?? "",
    task.brief.goal,
    ...(task.companies ?? []).map((company) => company.name),
  ]
    .join(" ")
    .toLowerCase();
  if (/cedarline|claims ledger|claims.pay|claims agent/.test(blob)) return "claims";
  if ((task.companies?.length ?? 0) >= 8 || /10[- ]slide|market overview|lakeshore/.test(blob)) {
    return "market";
  }
  if (/fir ridge|approved trade note|notes\.fir-ridge\.example/.test(blob)) return "approved";
  if (/harbor/.test(blob)) return "harbor";
  if (
    /diligence|ironwharf|kelp & keel|marshlight dye|cobb wharf|splitrock hardware|dunlin bindings/.test(
      blob,
    )
  ) {
    return "diligence";
  }
  return "other";
}

export function packLabel(pack: PackName): string {
  if (pack === "harbor") return "Harbor & Pine";
  if (pack === "diligence") return "Ironwharf diligence";
  if (pack === "market") return "Market comparison";
  if (pack === "approved") return "Approved web note";
  if (pack === "claims") return "Cedarline claims";
  if (pack === "staff") return "North Dock chief of staff";
  return "Other assignments";
}

export function deliveryScorePoints(task: StoredTask): number | undefined {
  const score = task.quality?.deliveryScore ?? task.evaluation?.deliveryScore;
  return typeof score === "number" ? score : undefined;
}

export function humanEffortLabel(task: StoredTask): string {
  const fixes = task.review?.fixRequests ?? 0;
  if (task.status === "accepted") {
    if (fixes === 0) return "accepted with 0 fixes";
    if (fixes === 1) return "1 fix then accepted";
    return `${fixes} fixes then accepted`;
  }
  if (task.status === "rejected") return "rejected";
  if (task.status === "awaiting_review" || task.status === "completed") {
    if (fixes === 0) return "awaiting review · 0 fixes so far";
    if (fixes === 1) return "awaiting review · 1 fix so far";
    return `awaiting review · ${fixes} fixes so far`;
  }
  if (task.status === "running" || task.status === "queued") return "working";
  if (task.status === "failed") return "failed";
  if (task.status === "blocked_on_approval") return "waiting for approval";
  return task.status.replaceAll("_", " ");
}

export const EFFORT_BOARD_NOTE =
  "Counts accepted and rejected runs, plus the newest assignment if it is still waiting for review. Older unfinished leftovers stay in Recent tasks and do not change the average.";

export interface PackEffortRow {
  pack: PackName;
  label: string;
  tasks: number;
  omitted: number;
  acceptedZeroFix: number;
  acceptedWithFixes: number;
  rejected: number;
  awaiting: number;
  averageDeliveryScore: number | undefined;
  averageInterventions: number;
  latestLabel?: string;
}

/** Human decisions, plus the newest run if it is still waiting for review. Pre-review leftovers are out. */
export function effortTasksForPack(items: StoredTask[]): StoredTask[] {
  const newestFirst = [...items].sort((a, b) => b.brief.createdAt.localeCompare(a.brief.createdAt));
  const decided = newestFirst.filter((task) => task.status === "accepted" || task.status === "rejected");
  const keep = new Set(decided.map((task) => task.brief.id));
  const newest = newestFirst[0];
  if (newest?.status === "awaiting_review") keep.add(newest.brief.id);
  return newestFirst.filter((task) => keep.has(task.brief.id));
}

export function summarizeEffort(tasks: StoredTask[]): PackEffortRow[] {
  const groups: PackName[] = ["staff", "harbor", "diligence", "market", "approved", "claims", "other"];
  return groups
    .map((pack) => {
      const items = tasks.filter((task) => packName(task) === pack);
      const counted = effortTasksForPack(items);
      const scores = counted
        .map((task) => deliveryScorePoints(task))
        .filter((score): score is number => typeof score === "number");
      const interventions = counted.map(
        (task) => task.review?.interventions ?? task.evaluation?.userInterventions ?? 0,
      );
      const latest = counted[0];
      return {
        pack,
        label: packLabel(pack),
        tasks: counted.length,
        omitted: items.length - counted.length,
        acceptedZeroFix: counted.filter((task) => task.status === "accepted" && (task.review?.fixRequests ?? 0) === 0)
          .length,
        acceptedWithFixes: counted.filter((task) => task.status === "accepted" && (task.review?.fixRequests ?? 0) > 0)
          .length,
        rejected: counted.filter((task) => task.status === "rejected").length,
        awaiting: counted.filter((task) => task.status === "awaiting_review").length,
        averageDeliveryScore:
          scores.length === 0
            ? undefined
            : Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)),
        averageInterventions:
          counted.length === 0
            ? 0
            : Number((interventions.reduce((sum, value) => sum + value, 0) / counted.length).toFixed(2)),
        latestLabel: latest ? humanEffortLabel(latest) : undefined,
      };
    })
    .filter((row) => row.tasks > 0);
}

export function formatEffortLine(task: StoredTask): string {
  const score = deliveryScorePoints(task);
  const scoreText = typeof score === "number" ? `Score ${Math.round(score * 100)} / 100` : "No score yet";
  return `${scoreText} · ${humanEffortLabel(task)}`;
}
