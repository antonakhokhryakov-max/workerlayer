import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AuditLog,
  ControlPlane,
  M1_ADVERTISED_CAPABILITIES,
  SANDBOX_EXECUTE_CAPABILITY,
  evaluatePolicy,
} from "@aether/control-plane";
import {
  PRODUCT_ALPHA_LABEL,
  PRODUCT_MOTTO,
  PRODUCT_NAME,
  PRODUCT_STACK_FROM,
  PRODUCT_STACK_TO,
  PRODUCT_TAGLINE,
  id,
} from "@aether/contracts";
import type { ActionRequest } from "@aether/contracts";
import {
  AetherPlatform,
  persistentWorkerId,
  queueCedarlineClaimsTask,
  queueSampleTask,
  runSampleTask,
} from "@aether/runtime";
import {
  detectDockerHealthy,
  selectComputeProvider,
  TaskWorkspace,
  COMPUTE_BACKEND_NOTE,
} from "@aether/workstation";
import { tempStore } from "./helpers";

function request(
  tool: ActionRequest["tool"],
  args: Record<string, unknown>,
  taskId: string,
): ActionRequest {
  return { id: id("req"), taskId, tool, args, requestedBy: "agent" };
}

describe("Alpha security properties", () => {
  it("labels the product as WorkerLayer Alpha — not for sensitive production workloads", () => {
    expect(PRODUCT_NAME).toBe("WorkerLayer");
    expect(PRODUCT_TAGLINE).toBe("The platform for deploying autonomous AI workers");
    expect(PRODUCT_MOTTO).toBe("Ideas → AI workers → real outcomes");
    expect(PRODUCT_ALPHA_LABEL).toMatch(/Alpha/i);
    expect(PRODUCT_ALPHA_LABEL).toMatch(/not for sensitive production workloads/i);
    expect(PRODUCT_STACK_FROM).toEqual(
      expect.arrayContaining(["model/agent", "tools/MCP", "credentials", "policy", "audit"]),
    );
    expect(PRODUCT_STACK_TO).toEqual(
      expect.arrayContaining(["browser/computer", "identity", "tools", "policy", "audit", "lifecycle"]),
    );
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/^# WorkerLayer/m);
    expect(readme).toMatch(/Ideas → AI workers → real outcomes/);
    expect(readme).toMatch(/The platform for deploying autonomous AI workers/);
    expect(readme).not.toMatch(/Temporary name/);
    const desk = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(desk).toMatch(/PRODUCT_MOTTO/);
    expect(desk).not.toMatch(/Temporary name/);
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/PRODUCT_MOTTO/);
  });

  it("two Harbor tasks share one persistent knowledge worker", () => {
    const store = tempStore();
    const plat = new AetherPlatform(store);
    const worker = plat.ensureWorker("knowledge");
    const a = plat.createTask(worker.id, {
      goal: "Harbor A",
      fileContents: [{ name: "a.md", bytes: "secret-a" }],
    });
    const b = plat.createTask(worker.id, {
      goal: "Harbor B",
      fileContents: [{ name: "b.md", bytes: "secret-b" }],
    });
    expect(worker.id).toBe(persistentWorkerId("knowledge"));
    expect(a.brief.workerId).toBe(worker.id);
    expect(b.brief.workerId).toBe(worker.id);
    expect(a.brief.capabilityManifestId).toMatch(/^cmf_/);
    expect(a.brief.capabilityManifestId).not.toBe(b.brief.capabilityManifestId);
    expect(plat.getWorker(worker.id)?.taskIds).toEqual(
      expect.arrayContaining([a.brief.id, b.brief.id]),
    );
  });

  it("Task A cannot read Task B files through policy, workspace, or isolation", async () => {
    const store = tempStore();
    const plat = new AetherPlatform(store);
    const worker = plat.ensureWorker("knowledge");
    const a = plat.createTask(worker.id, {
      goal: "Task A",
      fileContents: [{ name: "a.md", bytes: "alpha-only" }],
    });
    const b = plat.createTask(worker.id, {
      goal: "Task B",
      fileContents: [{ name: "secret.md", bytes: "bravo-secret" }],
    });

    const caps = plat.getManifest(a.brief.capabilityManifestId!)!;
    const fromPolicy = evaluatePolicy(
      request("workspace.read_file", { path: `${b.brief.id}/sources/secret.md` }, a.brief.id),
      {
        workspaceRoot: store.workspaceRoot(a.brief.id),
        allowedReadPrefixes: ["sources/", "originals/"],
        allowedWritePrefixes: ["artifacts/", "findings.json"],
        networkAllowlist: [],
        sensitiveDestinations: [],
        canExport: false,
        maxSteps: 8,
        granted: caps.granted,
        denied: caps.denied,
        requireApproval: caps.requireApproval,
      },
    );
    expect(fromPolicy.decision).toBe("deny");
    expect(fromPolicy.reason).toMatch(/cross-task/i);

    const workspaceA = new TaskWorkspace(store.workspaceRoot(a.brief.id));
    expect(workspaceA.readBytes("sources/a.md").toString()).toBe("alpha-only");
    expect(() => workspaceA.readBytes(join("..", b.brief.id, "sources", "secret.md"))).toThrow(
      /escape/i,
    );

    const envA = selectComputeProvider().create({
      taskId: a.brief.id,
      durableRoot: store.workspaceRoot(a.brief.id),
    });
    try {
      const bait = join(store.workspaceRoot(b.brief.id), "sources", "secret.md");
      const probe = envA.probeInside(bait);
      expect(probe.readable).toBe(false);
      expect(() => envA.workspace().readBytes("../secret.md")).toThrow(/escape/i);
    } finally {
      envA.destroy();
    }
  });

  it("denies a missing capability and records the deny outside the model", async () => {
    const store = tempStore();
    const plat = new AetherPlatform(store);
    const worker = plat.ensureWorker("knowledge");
    const task = plat.createTask(worker.id, {
      goal: "Missing capability",
      fileContents: [{ name: "note.md", bytes: "ok" }],
    });
    const manifest = plat.getManifest(task.brief.capabilityManifestId!)!;
    const capabilities = {
      workspaceRoot: store.workspaceRoot(task.brief.id),
      allowedReadPrefixes: ["sources/", "originals/"],
      allowedWritePrefixes: ["artifacts/", "findings.json"],
      networkAllowlist: [],
      sensitiveDestinations: [],
      canExport: false,
      maxSteps: 8,
      granted: manifest.granted.filter((item) => item !== SANDBOX_EXECUTE_CAPABILITY),
      denied: manifest.denied,
      requireApproval: manifest.requireApproval,
    };
    const audit = new AuditLog(store.auditPath(task.brief.id));
    const plane = new ControlPlane(audit, capabilities, task.brief);
    const handled = await plane.dispatch(
      request("python.execute", { source: "print(1)" }, task.brief.id),
      {
        execute: async () => {
          throw new Error("Workstation must not run a denied action.");
        },
      },
    );
    expect(handled.decision.decision).toBe("deny");
    expect(handled.result.status).toBe("denied");

    const onDisk = readFileSync(store.auditPath(task.brief.id), "utf8");
    expect(onDisk).toMatch(/policy.decide/);
    expect(onDisk).toMatch(/"decision":"deny"/);
    expect(plat.getAudit(task.brief.id).some((event) => event.decision === "deny")).toBe(true);
  });

  it("does not silently overwrite sealed originals", () => {
    const store = tempStore();
    const plat = new AetherPlatform(store);
    const worker = plat.ensureWorker("knowledge");
    const task = plat.createTask(worker.id, {
      goal: "Originals",
      fileContents: [{ name: "source.md", bytes: "original-text" }],
    });
    const originals = join(store.workspaceRoot(task.brief.id), "originals", "source.md");
    const sources = join(store.workspaceRoot(task.brief.id), "sources", "source.md");
    expect(readFileSync(originals, "utf8")).toBe("original-text");
    writeFileSync(sources, "mutated-in-sources");
    store.sealOriginals(task.brief.id);
    expect(readFileSync(originals, "utf8")).toBe("original-text");

    const workspace = new TaskWorkspace(store.workspaceRoot(task.brief.id));
    expect(() => workspace.writeBytes("originals/source.md", "nope")).toThrow(/immutable/);
    expect(() => workspace.writeBytes("sources/source.md", "nope")).toThrow(/immutable/);
    expect(readFileSync(originals, "utf8")).toBe("original-text");
  });

  it("tears the WorkerEnvironment down and keeps outputs plus the audit", () => {
    const store = tempStore();
    const plat = new AetherPlatform(store);
    const worker = plat.ensureWorker("knowledge");
    const task = plat.createTask(worker.id, {
      goal: "Lifecycle",
      fileContents: [{ name: "note.md", bytes: "keep-me" }],
    });
    const env = selectComputeProvider().create({
      taskId: task.brief.id,
      durableRoot: store.workspaceRoot(task.brief.id),
    });
    env.workspace().writeBytes("artifacts/result.txt", "done");
    const torn = env.destroy();
    expect(torn.destroyed).toBe(true);
    expect(torn.rootGone).toBe(true);
    expect(existsSync(env.root)).toBe(false);
    expect(existsSync(join(store.workspaceRoot(task.brief.id), "artifacts", "result.txt"))).toBe(
      true,
    );
    expect(existsSync(join(store.workspaceRoot(task.brief.id), "originals", "note.md"))).toBe(true);
  });

  it("auto-selects Docker when the daemon is healthy, else unshare-mount", () => {
    const provider = selectComputeProvider();
    expect(["docker", "unshare-mount", "process-filesystem"]).toContain(provider.kind);
    if (!detectDockerHealthy()) {
      expect(provider.kind).not.toBe("docker");
    } else {
      expect(provider.kind).toBe("docker");
    }
    expect(COMPUTE_BACKEND_NOTE).toMatch(/sticky per Task/i);
    expect(COMPUTE_BACKEND_NOTE).toMatch(/OEM packages/);
    expect(COMPUTE_BACKEND_NOTE).toMatch(/do not (choose|pick)/i);
    expect(M1_ADVERTISED_CAPABILITIES).toEqual(
      expect.arrayContaining([
        "files:read:task",
        "files:write:output",
        "code:execute:sandbox",
        "spreadsheet:create",
        "tool:invoke",
      ]),
    );
  });

  it("dogfood Harbor and Claims queue through AetherPlatform", () => {
    const plat = new AetherPlatform(tempStore());
    const harbor = queueSampleTask(plat);
    const claims = queueCedarlineClaimsTask(plat);
    expect(harbor.brief.workerId).toBe(persistentWorkerId("knowledge"));
    expect(claims.brief.workerId).toBe(persistentWorkerId("claims"));
    expect(harbor.brief.capabilityManifestId).toMatch(/^cmf_/);
    expect(claims.brief.capabilityManifestId).toMatch(/^cmf_/);
  });

  it("Harbor dogfood binds the knowledge worker and persists audit on disk", async () => {
    const store = tempStore();
    const { task } = await runSampleTask(store);
    expect(task.brief.workerId).toBe("wkr_knowledge");
    expect(task.brief.capabilityManifestId).toMatch(/^cmf_/);
    expect(task.environment?.spec.workerId).toBe("wkr_knowledge");
    expect(task.environment?.status).toBe("destroyed");
    expect(existsSync(store.auditPath(task.brief.id))).toBe(true);
    const auditText = readFileSync(store.auditPath(task.brief.id), "utf8");
    expect(auditText).toMatch(/worker.bound/);
    expect(auditText).toMatch(/policy.decide/);
    expect(auditText).toMatch(/environment.destroyed/);
    expect(auditText).toMatch(/"decision":"deny"/);
    const worker = store.getWorker("wkr_knowledge");
    expect(worker?.taskIds).toContain(task.brief.id);
  }, 60_000);
});
