import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { reviewTask, runSampleTask } from "@aether/runtime";
import { tempStore } from "./helpers";

function ensureHarborFixtures() {
  const memo = join(process.cwd(), "fixtures/harbor-and-pine/investor-memo.pdf");
  if (!existsSync(memo)) {
    execSync("pnpm exec tsx fixtures/harbor-and-pine/generate.ts", { cwd: process.cwd(), stdio: "pipe" });
  }
}

describe("Harbor sample 0-fix path", () => {
  it("finishes sendable at 100 with 0 interventions after the autonomous correction pass", async () => {
    ensureHarborFixtures();
    const store = tempStore();
    const { task } = await runSampleTask(store);

    expect(task.company).toMatch(/Harbor & Pine/);
    expect(task.companies?.length).toBe(1);
    expect(task.companies?.[0]?.funding).toMatch(/24/);
    expect(task.status).toBe("awaiting_review");
    expect(task.review?.interventions ?? 0).toBe(0);
    expect(task.qualityDraft?.sendableAfterOneReview).not.toBe(true);
    expect(task.qualityDraft?.issues.some((issue) => issue.code === "spreadsheet.missing_uncertainty")).toBe(
      true,
    );
    expect(task.qualityDraft?.issues.some((issue) => issue.code === "consistency.numbers_not_in_deck")).toBe(
      true,
    );
    expect(task.quality?.deliveryScore).toBe(1);
    expect(task.quality?.sendableAfterOneReview).toBe(true);
    expect(task.quality?.issues ?? []).toEqual([]);
    expect(task.identity?.status).toBe("active");
    expect(task.identity?.granted).not.toContain("network:fetch:allowlist");
    expect(task.brief.approvedDestinations ?? []).toEqual([]);
    expect(task.openedFiles?.some((path) => path.endsWith(".pdf"))).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith(".xlsx"))).toBe(true);
    expect(store.readAudit(task.brief.id).some((event) => event.decision === "deny")).toBe(true);
    const spawned = store.readAudit(task.brief.id).find((event) => event.action === "planner.spawned");
    expect(spawned?.details.isolated).toBe(true);
    expect(spawned?.details.pid).not.toBe(spawned?.details.hostPid);
    expect(store.readAudit(task.brief.id).some((event) => event.tool === "pdf.ocr")).toBe(false);
    expect(task.isolation?.status).toBe("destroyed");
    expect(task.isolation?.hostPathsBlocked).toBeGreaterThanOrEqual(2);
    expect(
      store.readAudit(task.brief.id).some((event) => event.action === "environment.destroyed"),
    ).toBe(true);

    const accepted = await reviewTask(store, task.brief.id, "accept");
    expect(accepted.status).toBe("accepted");
    expect(accepted.review?.interventions).toBe(0);
    expect(accepted.review?.fixRequests).toBe(0);
    expect(accepted.identity?.status).toBe("expired");
  }, 60_000);
});
