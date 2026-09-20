import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "@aether/agent";
import { newBrief, reviewTask, runKnowledgeTask } from "@aether/runtime";
import { tempStore, writeResearchPack } from "./helpers";

async function finishedTask() {
  const store = tempStore();
  const brief = newBrief(
    "Research this company using the attached materials. Produce a spreadsheet and presentation. Cite sources and flag uncertainty.",
    [
      { name: "company-brief.md", relativePath: "sources/company-brief.md" },
      { name: "notes.txt", relativePath: "sources/notes.txt" },
      { name: "memo.pdf", relativePath: "sources/memo.pdf" },
    ],
  );
  await writeResearchPack(store.workspaceRoot(brief.id));
  const { task } = await runKnowledgeTask(brief, {
    store,
    model: new DeterministicProvider(),
  });
  return { store, task };
}

describe("human review surface", () => {
  it("finishes awaiting review with zero interventions and an active worker identity", async () => {
    const { task } = await finishedTask();
    expect(task.status).toBe("awaiting_review");
    expect(task.review?.status).toBe("pending");
    expect(task.review?.interventions).toBe(0);
    expect(task.identity?.status).toBe("active");
    expect(task.quality?.sendableAfterOneReview).toBe(true);
    expect(task.artifacts.some((item) => item.kind === "spreadsheet")).toBe(true);
  });

  it("accepts the pack, expires the worker, and keeps interventions at zero", async () => {
    const { store, task } = await finishedTask();
    const accepted = await reviewTask(store, task.brief.id, "accept");
    expect(accepted.status).toBe("accepted");
    expect(accepted.review?.status).toBe("accepted");
    expect(accepted.review?.interventions).toBe(0);
    expect(accepted.identity?.status).toBe("expired");
    expect(store.readAudit(task.brief.id).some((event) => event.action === "review.accepted")).toBe(true);
    expect(store.readAudit(task.brief.id).some((event) => event.decision === "deny")).toBe(true);
  });

  it("rejects the pack as a human intervention and expires the worker", async () => {
    const { store, task } = await finishedTask();
    const rejected = await reviewTask(store, task.brief.id, "reject");
    expect(rejected.status).toBe("rejected");
    expect(rejected.review?.interventions).toBe(1);
    expect(rejected.identity?.status).toBe("expired");
  });

  it("applies one structured fix, re-scores, and offers review again", async () => {
    const { store, task } = await finishedTask();
    const scoreBefore = task.quality?.deliveryScore ?? 0;
    const fixed = await reviewTask(store, task.brief.id, "request_fix", "consistency");
    expect(fixed.status).toBe("awaiting_review");
    expect(fixed.review?.fixRequests).toBe(1);
    expect(fixed.review?.interventions).toBe(1);
    expect(fixed.review?.status).toBe("pending");
    expect(fixed.identity?.status).toBe("active");
    expect(fixed.quality?.deliveryScore ?? 0).toBeGreaterThanOrEqual(scoreBefore);
    expect(fixed.evaluation?.userInterventions ?? fixed.review?.interventions).toBe(1);
    const audit = store.readAudit(task.brief.id);
    expect(audit.some((event) => event.action === "review.fix_requested")).toBe(true);
    expect(audit.some((event) => event.action === "review.fix_finished")).toBe(true);
    expect(audit.filter((event) => event.action === "action.requested" && event.tool === "quality.check").length).toBeGreaterThanOrEqual(3);
    expect(audit.some((event) => event.decision === "deny")).toBe(true);
    const fixSpawned = audit.find(
      (event) => event.action === "planner.spawned" && event.details.via === "human_fix",
    );
    expect(fixSpawned?.details.isolated).toBe(true);
    expect(fixSpawned?.details.pid).not.toBe(fixSpawned?.details.hostPid);
    expect(fixSpawned?.details.hostPid).toBe(process.pid);

    const accepted = await reviewTask(store, task.brief.id, "accept");
    expect(accepted.status).toBe("accepted");
    expect(accepted.identity?.status).toBe("expired");
  });
});
