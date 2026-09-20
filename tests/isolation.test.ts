import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "@aether/agent";
import { defaultKnowledgeWorkCapabilities, evaluatePolicy } from "@aether/control-plane";
import type { ActionRequest } from "@aether/contracts";
import { id } from "@aether/contracts";
import { newBrief, runKnowledgeTask } from "@aether/runtime";
import {
  ProcessFilesystemProvider,
  detectUnshareMount,
  selectExecutionProvider,
} from "@aether/workstation";
import { tempStore, writeResearchPack } from "./helpers";

function request(tool: ActionRequest["tool"], args: Record<string, unknown>): ActionRequest {
  return { id: id("req"), taskId: "tsk_alpha", tool, args, requestedBy: "agent" };
}

describe("task environment isolation", () => {
  it("runs work in a replaceable env, tears it down, and keeps outputs plus audit", async () => {
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

    expect(task.status).toBe("awaiting_review");
    expect(task.isolation?.status).toBe("destroyed");
    expect(task.isolation?.environmentId).toMatch(/^env_/);
    expect(["docker", "unshare-mount", "process-filesystem"]).toContain(task.isolation?.provider);
    expect(task.isolation?.hostPathsBlocked).toBeGreaterThanOrEqual(2);

    const durable = store.workspaceRoot(brief.id);
    expect(existsSync(join(durable, "artifacts"))).toBe(true);
    expect(task.artifacts.every((item) => existsSync(join(durable, item.relativePath)))).toBe(true);
    expect(existsSync(store.auditPath(brief.id))).toBe(true);
    expect(
      existsSync(join(tmpdir(), "aether-env", `${brief.id}-${task.isolation!.environmentId}`)),
    ).toBe(false);

    const audit = store.readAudit(brief.id);
    expect(audit.some((event) => event.action === "environment.created")).toBe(true);
    expect(audit.some((event) => event.action === "environment.destroyed")).toBe(true);
    const created = audit.find((event) => event.action === "environment.created");
    expect(["docker", "unshare-mount", "process-filesystem"]).toContain(created?.details.provider);
    expect(created?.details.stickyPerTask).toBe(true);
    const probes = audit.filter((event) => event.action === "environment.probe");
    expect(probes.length).toBeGreaterThanOrEqual(2);
    expect(probes.every((event) => event.details.readable === false)).toBe(true);
    expect(probes.some((event) => String(event.details.path).includes("/etc/passwd"))).toBe(true);
    expect(audit.some((event) => event.decision === "deny" && event.tool === "network.fetch")).toBe(
      true,
    );
    expect(
      audit.some(
        (event) => event.decision === "deny" && /cross-task/i.test(String(event.details.reason)),
      ),
    ).toBe(true);
  });

  it("cannot read a host path or sibling secret from inside the env", () => {
    const store = tempStore();
    const durable = store.workspaceRoot("tsk_iso");
    mkdirSync(join(durable, "sources"), { recursive: true });
    writeFileSync(join(durable, "sources", "ok.txt"), "in-scope");
    const sibling = join(durable, "..", "cross-task-secret.txt");
    writeFileSync(sibling, "payroll-should-stay-out");

    const env = selectExecutionProvider().create({
      taskId: "tsk_iso",
      durableRoot: durable,
    });
    try {
      expect(env.workspace().readBytes("sources/ok.txt").toString()).toBe("in-scope");
      expect(() => env.workspace().readBytes("../cross-task-secret.txt")).toThrow(/escape/i);

      const host = env.probeInside("/etc/passwd");
      expect(host.readable).toBe(false);
      const other = env.probeInside(sibling);
      expect(other.readable).toBe(false);

      if (env.kind === "unshare-mount") {
        const inside = env.probeInside("/task/sources/ok.txt");
        expect(inside.readable).toBe(true);
        expect(inside.error).toBeUndefined();
      }
    } finally {
      const torn = env.destroy();
      expect(torn.rootGone).toBe(true);
      expect(existsSync(join(durable, "sources", "ok.txt"))).toBe(true);
    }
  });

  it("still denies undeclared capabilities and cross-task reads at the control plane", () => {
    const capabilities = defaultKnowledgeWorkCapabilities("/tmp/ws");
    expect(
      evaluatePolicy(request("network.fetch", { url: "https://news.example/search" }), capabilities)
        .decision,
    ).toBe("deny");
    expect(
      evaluatePolicy(
        request("workspace.read_file", { path: "tsk_payroll/sources/payroll.csv" }),
        capabilities,
      ).reason,
    ).toMatch(/cross-task/i);
    capabilities.granted = capabilities.granted.filter((item) => item !== "pdf:ocr");
    expect(
      evaluatePolicy(request("pdf.ocr", { path: "sources/scan.pdf" }), capabilities).decision,
    ).toBe("deny");
  });

  it("offers a process+filesystem provider when a caller asks for the fallback", () => {
    const store = tempStore();
    const durable = store.workspaceRoot("tsk_fallback");
    mkdirSync(join(durable, "sources"), { recursive: true });
    writeFileSync(join(durable, "sources", "note.txt"), "hello");
    const env = new ProcessFilesystemProvider().create({
      taskId: "tsk_fallback",
      durableRoot: durable,
    });
    expect(env.kind).toBe("process-filesystem");
    expect(env.probeInside("/etc/passwd").readable).toBe(false);
    env.destroy();
  });

  it("detects whether this host can use a user+mount namespace", () => {
    expect(typeof detectUnshareMount()).toBe("boolean");
  });
});
