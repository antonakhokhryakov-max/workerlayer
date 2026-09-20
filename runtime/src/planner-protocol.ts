import type { AgentIntent, ArtifactRecord, FixTarget, HandledAction, TaskBrief, WorkPlan } from "@aether/contracts";
import type { StoredTask } from "./store";

export type PlannerSnapshot = Pick<
  StoredTask,
  | "plan"
  | "findings"
  | "company"
  | "summary"
  | "citations"
  | "uncertainties"
  | "companies"
  | "quality"
  | "qualityDraft"
  | "openedFiles"
  | "researchNotes"
>;

export type PlannerParentMessage =
  | { id: number; op: "init"; kind: string }
  | { id: number; op: "plan"; brief: TaskBrief }
  | { id: number; op: "nextIntent"; brief: TaskBrief }
  | { id: number; op: "observe"; handled: HandledAction }
  | { id: number; op: "hydrate"; snapshot: PlannerSnapshot; artifacts?: ArtifactRecord[] }
  | { id: number; op: "beginFix"; target: FixTarget }
  | { id: number; op: "shutdown" };

export type PlannerChildMessage =
  | { id: number; ok: true; pid: number }
  | { id: number; plan: WorkPlan; snapshot: PlannerSnapshot; delivered: boolean }
  | { id: number; intent: AgentIntent; snapshot: PlannerSnapshot; delivered: boolean }
  | { id: number; snapshot: PlannerSnapshot; delivered: boolean }
  | { id: number; error: string };

export const SNAPSHOT_KEYS = [
  "plan",
  "findings",
  "company",
  "summary",
  "citations",
  "uncertainties",
  "companies",
  "quality",
  "qualityDraft",
  "openedFiles",
  "researchNotes",
] as const;
