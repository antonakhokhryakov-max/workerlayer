import { describe, expect, it } from "vitest";
import type { StoredTask } from "@aether/runtime";
import { formatEffortLine, humanEffortLabel, packName, summarizeEffort } from "@aether/runtime";

function task(partial: Partial<StoredTask> & Pick<StoredTask, "status">): StoredTask {
  return {
    brief: {
      id: "tsk_test",
      goal: partial.company ? "Research this company." : "Create a 10-slide market overview.",
      createdAt: "2026-09-19T00:00:00.000Z",
      createdBy: { type: "user", id: "user_operator", name: "Anton" },
      sourceFiles: [],
    },
    findings: [],
    artifacts: [],
    modelProvider: "deterministic",
    ...partial,
  };
}

describe("human effort labels", () => {
  it("names 0-fix accepts, fix-then-accept, and reject in plain English", () => {
    expect(
      humanEffortLabel(
        task({
          status: "accepted",
          company: "Harbor & Pine Outdoor Co.",
          review: { status: "accepted", fixRequests: 0, interventions: 0, history: [] },
        }),
      ),
    ).toBe("accepted with 0 fixes");
    expect(
      humanEffortLabel(
        task({
          status: "accepted",
          review: { status: "accepted", fixRequests: 1, interventions: 1, history: [] },
        }),
      ),
    ).toBe("1 fix then accepted");
    expect(
      humanEffortLabel(
        task({
          status: "rejected",
          review: { status: "rejected", fixRequests: 0, interventions: 1, history: [] },
        }),
      ),
    ).toBe("rejected");
    expect(
      formatEffortLine(
        task({
          status: "accepted",
          company: "Harbor & Pine Outdoor Co.",
          quality: {
            ok: true,
            issues: [],
            inspected: [],
            pass: "final",
            deliveryScore: 1,
            sendableAfterOneReview: true,
          },
          review: { status: "accepted", fixRequests: 0, interventions: 0, history: [] },
        }),
      ),
    ).toBe("Score 100 / 100 · accepted with 0 fixes");
  });

  it("compares Harbor and market packs side by side", () => {
    const rows = summarizeEffort([
      task({
        status: "accepted",
        company: "Harbor & Pine Outdoor Co.",
        brief: {
          id: "tsk_h",
          goal: "Research Harbor & Pine using the attached materials.",
          createdAt: "2026-09-19T02:00:00.000Z",
          createdBy: { type: "user", id: "user_operator", name: "Anton" },
          sourceFiles: [],
        },
        quality: { ok: true, issues: [], inspected: [], pass: "final", deliveryScore: 1 },
        review: { status: "accepted", fixRequests: 0, interventions: 0, history: [] },
      }),
      task({
        status: "accepted",
        companies: Array.from({ length: 18 }, (_, index) => ({
          name: `Co ${index}`,
          sources: [],
          missing: [],
          conflicts: [],
        })),
        brief: {
          id: "tsk_m",
          goal: "Create a 10-slide market overview.",
          createdAt: "2026-09-19T01:00:00.000Z",
          createdBy: { type: "user", id: "user_operator", name: "Anton" },
          sourceFiles: [],
        },
        quality: { ok: true, issues: [], inspected: [], pass: "final", deliveryScore: 0.82 },
        review: { status: "accepted", fixRequests: 1, interventions: 1, history: [] },
      }),
    ]);

    const harbor = rows.find((row) => row.pack === "harbor");
    const market = rows.find((row) => row.pack === "market");
    expect(harbor?.acceptedZeroFix).toBe(1);
    expect(harbor?.averageDeliveryScore).toBe(1);
    expect(harbor?.averageInterventions).toBe(0);
    expect(market?.acceptedWithFixes).toBe(1);
    expect(market?.averageInterventions).toBe(1);
    expect(market?.latestLabel).toBe("1 fix then accepted");
    expect(harbor?.omitted).toBe(0);
  });

  it("drops stale pre-review leftovers from Harbor's average without rewriting them", () => {
    const rows = summarizeEffort([
      task({
        status: "accepted",
        company: "Harbor & Pine Outdoor Co.",
        brief: {
          id: "tsk_now",
          goal: "Research Harbor & Pine using the attached materials.",
          createdAt: "2026-09-19T04:00:00.000Z",
          createdBy: { type: "user", id: "user_operator", name: "Anton" },
          sourceFiles: [],
        },
        quality: { ok: true, issues: [], inspected: [], pass: "final", deliveryScore: 1 },
        review: { status: "accepted", fixRequests: 0, interventions: 0, history: [] },
      }),
      task({
        status: "accepted",
        company: "Harbor & Pine Outdoor Co.",
        brief: {
          id: "tsk_fix",
          goal: "Research Harbor & Pine using the attached materials.",
          createdAt: "2026-09-19T03:00:00.000Z",
          createdBy: { type: "user", id: "user_operator", name: "Anton" },
          sourceFiles: [],
        },
        quality: { ok: true, issues: [], inspected: [], pass: "final", deliveryScore: 1 },
        review: { status: "accepted", fixRequests: 1, interventions: 1, history: [] },
      }),
      task({
        status: "completed",
        company: "2-company comparison",
        companies: [
          { name: "Harbor & Pine Outdoor Co.", sources: [], missing: [], conflicts: [] },
          { name: "Harbor & Pine", sources: [], missing: [], conflicts: [] },
        ],
        brief: {
          id: "tsk_corpse",
          goal: "Research this company using the attached materials.",
          createdAt: "2026-09-19T01:00:00.000Z",
          createdBy: { type: "user", id: "user_operator", name: "Anton" },
          sourceFiles: [],
        },
        quality: { ok: false, issues: [], inspected: [], pass: "corrected", deliveryScore: 0.64 },
      }),
      task({
        status: "awaiting_review",
        company: "Harbor & Pine Outdoor Co.",
        brief: {
          id: "tsk_old_wait",
          goal: "Research Harbor & Pine using the attached materials.",
          createdAt: "2026-09-19T02:00:00.000Z",
          createdBy: { type: "user", id: "user_operator", name: "Anton" },
          sourceFiles: [],
        },
        quality: { ok: true, issues: [], inspected: [], pass: "final", deliveryScore: 0.64 },
        review: { status: "pending", fixRequests: 0, interventions: 0, history: [] },
      }),
    ]);

    const harbor = rows.find((row) => row.pack === "harbor");
    expect(harbor?.acceptedZeroFix).toBe(1);
    expect(harbor?.acceptedWithFixes).toBe(1);
    expect(harbor?.averageDeliveryScore).toBe(1);
    expect(harbor?.awaiting).toBe(0);
    expect(harbor?.omitted).toBe(2);
    expect(harbor?.latestLabel).toBe("accepted with 0 fixes");
    expect(harbor?.tasks).toBe(2);
  });

  it("still counts the latest awaiting-review run when that is the current work", () => {
    const rows = summarizeEffort([
      task({
        status: "awaiting_review",
        company: "Harbor & Pine Outdoor Co.",
        brief: {
          id: "tsk_live",
          goal: "Research Harbor & Pine using the attached materials.",
          createdAt: "2026-09-19T05:00:00.000Z",
          createdBy: { type: "user", id: "user_operator", name: "Anton" },
          sourceFiles: [],
        },
        quality: { ok: true, issues: [], inspected: [], pass: "final", deliveryScore: 1 },
        review: { status: "pending", fixRequests: 0, interventions: 0, history: [] },
      }),
      task({
        status: "accepted",
        company: "Harbor & Pine Outdoor Co.",
        brief: {
          id: "tsk_prior",
          goal: "Research Harbor & Pine using the attached materials.",
          createdAt: "2026-09-19T04:00:00.000Z",
          createdBy: { type: "user", id: "user_operator", name: "Anton" },
          sourceFiles: [],
        },
        quality: { ok: true, issues: [], inspected: [], pass: "final", deliveryScore: 1 },
        review: { status: "accepted", fixRequests: 0, interventions: 0, history: [] },
      }),
    ]);
    const harbor = rows.find((row) => row.pack === "harbor");
    expect(harbor?.awaiting).toBe(1);
    expect(harbor?.acceptedZeroFix).toBe(1);
    expect(harbor?.averageDeliveryScore).toBe(1);
    expect(harbor?.latestLabel).toBe("awaiting review · 0 fixes so far");
    expect(harbor?.omitted).toBe(0);
  });

  it("names the Fir Ridge approved-web pack on its own row", () => {
    expect(
      packName(
        task({
          status: "accepted",
          company: "Fir Ridge Cooperage",
          brief: {
            id: "tsk_a",
            goal: "Research Fir Ridge Cooperage using the attached materials and any destination this assignment approved.",
            createdAt: "2026-09-20T01:00:00.000Z",
            createdBy: { type: "user", id: "user_operator", name: "Anton" },
            sourceFiles: [],
          },
        }),
      ),
    ).toBe("approved");
  });

  it("names the Ironwharf diligence pack on its own row", () => {
    expect(
      packName(
        task({
          status: "accepted",
          company: "6-company comparison",
          companies: [
            { name: "Ironwharf Canvas", sources: [], missing: [], conflicts: [] },
            { name: "Splitrock Hardware", sources: [], missing: [], conflicts: [] },
          ],
          brief: {
            id: "tsk_d",
            goal: "Complete supplier diligence on the attached millwork and canvas vendors.",
            createdAt: "2026-09-20T00:00:00.000Z",
            createdBy: { type: "user", id: "user_operator", name: "Anton" },
            sourceFiles: [],
          },
        }),
      ),
    ).toBe("diligence");
  });

  it("counts a Harbor split listed as a 2-company comparison as Harbor", () => {
    expect(
      packName(
        task({
          status: "completed",
          company: "2-company comparison",
          companies: [
            { name: "Harbor & Pine Outdoor Co.", sources: [], missing: [], conflicts: [] },
            { name: "Harbor & Pine", sources: [], missing: [], conflicts: [] },
          ],
        }),
      ),
    ).toBe("harbor");
  });
});
