import {
  BENCHMARK_GOAL,
  LAKESHORE_MOSSLINE_URL,
  benchmarkFiles,
  groundTruthPath,
} from "../../fixtures/lakeshore-market/manifest";
import { SAMPLE_GOAL, sampleFiles } from "../../fixtures/harbor-and-pine/manifest";
import { DILIGENCE_GOAL, diligenceFiles } from "../../fixtures/ironwharf-diligence/manifest";
import {
  APPROVED_GOAL,
  FIR_RIDGE_APPROVED_URL,
  approvedFiles,
} from "../../fixtures/fir-ridge/manifest";
import { CLAIMS_GOAL, claimsFiles } from "../../fixtures/cedarline-claims/manifest";
import {
  INVESTOR_GOAL,
  WEEKLY_GOAL,
  WEEKLY_TOOLS,
  INVESTOR_TOOLS,
  investorFiles,
  weeklyFiles,
} from "../../fixtures/north-dock-staff/manifest";
import type { RunResult } from "./kernel";
import { AetherPlatform } from "./platform";
import { TaskStore, type StoredTask } from "./store";
import type { WorkerKind } from "@aether/contracts";

function queueOn(
  plat: AetherPlatform,
  kind: WorkerKind,
  goal: string,
  files: Array<{ name: string; absolutePath: string }>,
  approvedDestinations?: string[],
): StoredTask {
  const worker = plat.ensureWorker(kind);
  return plat.createTask(worker.id, { goal, files, approvedDestinations });
}

export function queueSampleTask(plat: AetherPlatform | TaskStore = new TaskStore()) {
  return queueOn(asPlatform(plat), "knowledge", SAMPLE_GOAL, sampleFiles());
}

export function queueBenchmarkTask(plat: AetherPlatform | TaskStore = new TaskStore()) {
  return queueOn(
    asPlatform(plat),
    "knowledge",
    BENCHMARK_GOAL,
    benchmarkFiles(),
    [LAKESHORE_MOSSLINE_URL],
  );
}

export function queueApprovedTask(plat: AetherPlatform | TaskStore = new TaskStore()) {
  return queueOn(
    asPlatform(plat),
    "knowledge",
    APPROVED_GOAL,
    approvedFiles(),
    [FIR_RIDGE_APPROVED_URL],
  );
}

export function queueDiligenceTask(plat: AetherPlatform | TaskStore = new TaskStore()) {
  return queueOn(asPlatform(plat), "knowledge", DILIGENCE_GOAL, diligenceFiles());
}

export function queueCedarlineClaimsTask(plat: AetherPlatform | TaskStore = new TaskStore()) {
  return queueOn(asPlatform(plat), "claims", CLAIMS_GOAL, claimsFiles());
}

function queueStaff(
  plat: AetherPlatform | TaskStore,
  goal: string,
  files: Array<{ name: string; absolutePath: string }>,
  tools: typeof WEEKLY_TOOLS,
) {
  const platform = asPlatform(plat);
  const worker = platform.ensureWorker("chief_of_staff");
  return platform.createTask(worker.id, {
    goal,
    files,
    registeredTools: tools,
  });
}

export function queueStaffWeeklyTask(plat: AetherPlatform | TaskStore = new TaskStore()) {
  return queueStaff(plat, WEEKLY_GOAL, weeklyFiles(), WEEKLY_TOOLS);
}

export function queueStaffInvestorTask(plat: AetherPlatform | TaskStore = new TaskStore()) {
  return queueStaff(plat, INVESTOR_GOAL, investorFiles(), INVESTOR_TOOLS);
}

export async function runSampleTask(store = new TaskStore()): Promise<RunResult> {
  const plat = new AetherPlatform(store);
  const queued = queueSampleTask(plat);
  return plat.runTask(queued.brief.id);
}

export async function runBenchmarkTask(store = new TaskStore()): Promise<RunResult> {
  const plat = new AetherPlatform(store);
  const queued = queueBenchmarkTask(plat);
  return plat.runTask(queued.brief.id, { groundTruthPath: groundTruthPath() });
}

export async function runDiligenceTask(store = new TaskStore()): Promise<RunResult> {
  const plat = new AetherPlatform(store);
  const queued = queueDiligenceTask(plat);
  return plat.runTask(queued.brief.id);
}

export async function runApprovedTask(store = new TaskStore()): Promise<RunResult> {
  const plat = new AetherPlatform(store);
  const queued = queueApprovedTask(plat);
  return plat.runTask(queued.brief.id);
}

export async function runCedarlineClaimsTask(store = new TaskStore()): Promise<RunResult> {
  const plat = new AetherPlatform(store);
  const queued = queueCedarlineClaimsTask(plat);
  return plat.runTask(queued.brief.id);
}

export async function runStaffWeeklyTask(store = new TaskStore()): Promise<RunResult> {
  const plat = new AetherPlatform(store);
  const queued = queueStaffWeeklyTask(plat);
  return plat.runTask(queued.brief.id);
}

export async function runStaffInvestorTask(store = new TaskStore()): Promise<RunResult> {
  const plat = new AetherPlatform(store);
  const queued = queueStaffInvestorTask(plat);
  return plat.runTask(queued.brief.id);
}

function asPlatform(plat: AetherPlatform | TaskStore): AetherPlatform {
  return plat instanceof AetherPlatform ? plat : new AetherPlatform(plat);
}
