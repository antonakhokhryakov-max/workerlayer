/**
 * Untrusted planner process. Speaks intents only.
 * Must not import the workstation or the trusted grant APIs.
 */
import { DeterministicProvider } from "@aether/agent";
import "./builtins";
import { loadVerticals } from "./load-verticals";
import { emptyReview } from "./store";
import type { StoredTask } from "./store";
import { requireWorkerRegistration, type VerticalPlanner } from "./registry";
import { SNAPSHOT_KEYS, type PlannerChildMessage, type PlannerParentMessage, type PlannerSnapshot } from "./planner-protocol";

let planner: VerticalPlanner | undefined;
const scratch: StoredTask = {
  brief: {
    id: "tsk_planner",
    goal: "",
    createdAt: "",
    createdBy: { type: "agent", id: "planner", name: "planner" },
    sourceFiles: [],
  },
  status: "running",
  findings: [],
  artifacts: [],
  review: emptyReview(),
};

function snapshot(): PlannerSnapshot {
  const out: PlannerSnapshot = {};
  for (const key of SNAPSHOT_KEYS) {
    if (scratch[key] !== undefined) {
      (out as Record<string, unknown>)[key] = scratch[key];
    }
  }
  return out;
}

function reply(message: PlannerChildMessage): void {
  if (!process.send) {
    process.stderr.write("planner-host: no IPC channel\n");
    process.exit(1);
  }
  process.send(message);
}

process.on("message", async (raw: PlannerParentMessage) => {
  try {
    if (raw.op === "init") {
      await loadVerticals();
      const model =
        process.env.AETHER_PLANNER_MODEL === "deterministic"
          ? new DeterministicProvider()
          : undefined;
      planner = requireWorkerRegistration(raw.kind).createPlanner({ model });
      reply({ id: raw.id, ok: true, pid: process.pid });
      return;
    }
    if (raw.op === "shutdown") {
      process.exit(0);
    }
    if (!planner) throw new Error("Planner was not initialized.");
    if (raw.op === "plan") {
      scratch.brief = raw.brief;
      scratch.plan = await Promise.resolve(planner.plan(raw.brief));
      planner.applyToTask(scratch);
      reply({ id: raw.id, plan: scratch.plan!, snapshot: snapshot(), delivered: planner.isDelivered() });
      return;
    }
    if (raw.op === "nextIntent") {
      scratch.brief = raw.brief;
      const intent = await planner.nextIntent(raw.brief);
      reply({
        id: raw.id,
        intent,
        snapshot: snapshot(),
        delivered: planner.isDelivered(),
      });
      return;
    }
    if (raw.op === "observe") {
      await Promise.resolve(planner.observe(raw.handled));
      planner.applyToTask(scratch);
      reply({ id: raw.id, snapshot: snapshot(), delivered: planner.isDelivered() });
      return;
    }
    if (raw.op === "hydrate") {
      for (const key of SNAPSHOT_KEYS) {
        const value = raw.snapshot[key];
        if (value !== undefined) {
          (scratch as Record<string, unknown>)[key] = value;
        }
      }
      if (raw.artifacts) scratch.artifacts = raw.artifacts;
      await Promise.resolve(planner.hydrate?.(scratch));
      planner.applyToTask(scratch);
      reply({ id: raw.id, snapshot: snapshot(), delivered: planner.isDelivered() });
      return;
    }
    if (raw.op === "beginFix") {
      await Promise.resolve(planner.beginFix?.(raw.target));
      planner.applyToTask(scratch);
      reply({ id: raw.id, snapshot: snapshot(), delivered: planner.isDelivered() });
    }
  } catch (error) {
    reply({
      id: raw.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
