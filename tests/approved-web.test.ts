import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultKnowledgeWorkCapabilities, evaluatePolicy } from "@aether/control-plane";
import type { ActionRequest } from "@aether/contracts";
import { id } from "@aether/contracts";
import { reviewTask, runApprovedTask } from "@aether/runtime";
import { FIR_RIDGE_APPROVED_URL } from "../fixtures/fir-ridge/manifest";
import { LAKESHORE_MOSSLINE_URL } from "../fixtures/lakeshore-market/manifest";
import { tempStore } from "./helpers";

function request(tool: ActionRequest["tool"], args: Record<string, unknown>): ActionRequest {
  return { id: id("req"), taskId: "tsk_test", tool, args, requestedBy: "agent" };
}

describe("allowlisted web research", () => {
  it("allows only the approved destination and still denies the open web", () => {
    const capabilities = defaultKnowledgeWorkCapabilities("/tmp/ws", [FIR_RIDGE_APPROVED_URL]);
    expect(capabilities.granted).toContain("network:fetch:allowlist");
    expect(capabilities.denied).toContain("network:fetch");
    expect(
      evaluatePolicy(request("network.fetch", { url: FIR_RIDGE_APPROVED_URL }), capabilities)
        .decision,
    ).toBe("allow");
    expect(
      evaluatePolicy(request("network.fetch", { url: "https://news.example/search" }), capabilities)
        .decision,
    ).toBe("deny");
    expect(
      evaluatePolicy(request("network.fetch", { url: "https://evil.example/exfil" }), capabilities)
        .decision,
    ).toBe("deny");
    expect(
      evaluatePolicy(request("network.fetch", { url: LAKESHORE_MOSSLINE_URL }), capabilities)
        .decision,
    ).toBe("deny");
  });

  it("grants each assignment only its own approved destination", () => {
    const market = defaultKnowledgeWorkCapabilities("/tmp/ws", [LAKESHORE_MOSSLINE_URL]);
    expect(market.granted).toContain("network:fetch:allowlist");
    expect(market.denied).toContain("network:fetch");
    expect(
      evaluatePolicy(request("network.fetch", { url: LAKESHORE_MOSSLINE_URL }), market).decision,
    ).toBe("allow");
    expect(
      evaluatePolicy(request("network.fetch", { url: FIR_RIDGE_APPROVED_URL }), market).decision,
    ).toBe("deny");
    expect(
      evaluatePolicy(request("network.fetch", { url: "https://news.example/search" }), market)
        .decision,
    ).toBe("deny");
  });

  it("default assignments still deny every fetch", () => {
    const capabilities = defaultKnowledgeWorkCapabilities("/tmp/ws");
    expect(capabilities.granted).not.toContain("network:fetch:allowlist");
    expect(
      evaluatePolicy(request("network.fetch", { url: FIR_RIDGE_APPROVED_URL }), capabilities)
        .decision,
    ).toBe("deny");
    expect(
      evaluatePolicy(request("network.fetch", { url: LAKESHORE_MOSSLINE_URL }), capabilities)
        .decision,
    ).toBe("deny");
  });

  it("finishes Fir Ridge sendable using the allowlisted note and denying the open web", async () => {
    const store = tempStore();
    const { task } = await runApprovedTask(store);

    expect(task.company).toMatch(/Fir Ridge Cooperage/i);
    expect(task.status).toBe("awaiting_review");
    expect(task.quality?.deliveryScore).toBe(1);
    expect(task.quality?.sendableAfterOneReview).toBe(true);
    expect(task.review?.interventions ?? 0).toBe(0);
    expect(task.identity?.granted).toContain("network:fetch:allowlist");
    expect(task.identity?.denied).toContain("network:fetch");
    expect(task.companies?.[0]?.funding).toMatch(/4\.2/);
    expect(task.companies?.[0]?.customers).toMatch(/North Coast Distillers/i);
    expect(task.isolation?.status).toBe("destroyed");

    const fetched = join(
      store.workspaceRoot(task.brief.id),
      "artifacts/approved-web/notes.fir-ridge.example-profile.txt",
    );
    expect(existsSync(fetched)).toBe(true);

    const audit = store.readAudit(task.brief.id);
    const fetches = audit.filter(
      (event) => event.tool === "network.fetch" && event.action === "policy.decide",
    );
    expect(fetches.some((event) => event.decision === "allow")).toBe(true);
    expect(fetches.some((event) => event.decision === "deny")).toBe(true);
    expect(
      fetches.some(
        (event) =>
          event.decision === "deny" &&
          String(event.details.reason ?? "").includes("news.example"),
      ),
    ).toBe(true);
    expect(audit.some((event) => event.action === "environment.destroyed")).toBe(true);
    expect(
      audit.some(
        (event) => event.decision === "deny" && /cross-task/i.test(String(event.details.reason)),
      ),
    ).toBe(true);

    const accepted = await reviewTask(store, task.brief.id, "accept");
    expect(accepted.status).toBe("accepted");
    expect(accepted.review?.fixRequests).toBe(0);
    expect(accepted.identity?.status).toBe("expired");
    expect(existsSync(fetched)).toBe(true);
  }, 60_000);
});
