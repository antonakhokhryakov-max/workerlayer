import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packName, reviewTask, runDiligenceTask } from "@aether/runtime";
import { tempStore } from "./helpers";

function ensureDiligenceFixtures() {
  const table = join(process.cwd(), "fixtures/ironwharf-diligence/bonded-hold-scan.pdf");
  if (!existsSync(table)) {
    execSync("pnpm exec tsx fixtures/ironwharf-diligence/generate.ts", {
      cwd: process.cwd(),
      stdio: "pipe",
    });
  }
}

describe("Ironwharf diligence pack", () => {
  it("finishes sendable at 100 with 0 interventions on harder multi-source materials", async () => {
    ensureDiligenceFixtures();
    const store = tempStore();
    const { task } = await runDiligenceTask(store);

    expect(packName(task)).toBe("diligence");
    expect(task.companies?.length).toBe(6);
    expect(task.companies?.some((company) => company.name === "Ironwharf Canvas")).toBe(true);
    expect(task.companies?.some((company) => company.conflicts.length > 0)).toBe(true);
    expect(task.uncertainties?.some((flag) => /conflict|3\.1|4\.8/i.test(flag.note))).toBe(true);
    expect(task.status).toBe("awaiting_review");
    expect(task.review?.interventions ?? 0).toBe(0);
    expect(task.qualityDraft?.sendableAfterOneReview).not.toBe(true);
    expect(task.quality?.deliveryScore).toBe(1);
    expect(task.quality?.sendableAfterOneReview).toBe(true);
    expect(task.quality?.issues ?? []).toEqual([]);
    expect(task.openedFiles?.some((path) => path.endsWith("capacity-table.pdf"))).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith("overlapping-memo.pdf"))).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith("shop-floor-scan.pdf"))).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith("mill-invoice-scan.pdf"))).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith("bonded-hold-scan.pdf"))).toBe(true);
    expect(task.openedFiles?.some((path) => path.endsWith(".xlsx"))).toBe(true);
    expect(
      task.findings.some((finding) => /invoice/i.test(finding.finding) && /410/.test(`${finding.finding} ${finding.evidence}`)),
    ).toBe(true);
    expect(task.findings.some((finding) => /287/.test(`${finding.finding} ${finding.evidence}`))).toBe(false);
    expect(
      task.uncertainties?.some(
        (flag) => /bonded-hold-scan|warehouse-hold/i.test(flag.note) && /did not recover a readable amount/i.test(flag.note),
      ),
    ).toBe(true);
    expect(store.readAudit(task.brief.id).some((event) => event.tool === "pdf.ocr" && event.decision === "allow")).toBe(
      true,
    );
    expect(task.uncertainties?.some((flag) => /ocr|scan|confidence/i.test(flag.note))).toBe(true);
    expect(task.identity?.granted).toContain("pdf:ocr");
    expect(
      task.companies?.some(
        (company) =>
          company.name === "Splitrock Hardware" &&
          company.conflicts.some((item) => item.values.some((value) => /2\.0|1\.6/.test(value))),
      ),
    ).toBe(true);
    expect(task.identity?.status).toBe("active");
    expect(task.identity?.granted).not.toContain("network:fetch:allowlist");
    expect(task.brief.approvedDestinations ?? []).toEqual([]);
    expect(store.readAudit(task.brief.id).some((event) => event.decision === "deny")).toBe(true);
    expect(task.governance?.deniedActions).toBeGreaterThanOrEqual(1);

    const accepted = await reviewTask(store, task.brief.id, "accept");
    expect(accepted.status).toBe("accepted");
    expect(accepted.review?.interventions).toBe(0);
    expect(accepted.identity?.status).toBe("expired");
    expect(packName(accepted)).toBe("diligence");
  }, 60_000);
});
