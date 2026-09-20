import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "@aether/agent";
import {
  compileDeclaredEnvironment,
  declareWorkerEnvironment,
  defaultKnowledgeWorkCapabilities,
  evaluatePolicy,
  SANDBOX_EXECUTE_CAPABILITY,
} from "@aether/control-plane";
import type { ActionRequest, WorkerEnvironmentSpec } from "@aether/contracts";
import { id } from "@aether/contracts";
import { newBrief, runKnowledgeTask, runSampleTask } from "@aether/runtime";
import {
  composeWorkerEnvironment,
  executePythonSandbox,
  selectExecutionProvider,
  substrateFor,
} from "@aether/workstation";
import { tempStore, writeResearchPack } from "./helpers";

function request(tool: ActionRequest["tool"], args: Record<string, unknown>): ActionRequest {
  return { id: id("req"), taskId: "tsk_test", tool, args, requestedBy: "agent" };
}

describe("Platform Milestone 1 WorkerEnvironment", () => {
  it("compiles only an explicitly declared spec and does not add capabilities", () => {
    const spec = declareWorkerEnvironment({
      assignmentId: "tsk_demo",
      granted: ["spreadsheet:create", SANDBOX_EXECUTE_CAPABILITY],
      denied: ["network:fetch"],
    });
    expect(spec.compiledFrom).toBe("declared");
    expect(spec.substrates).toEqual(["DIRECT_TOOL", "SANDBOX"]);
    const compiled = compileDeclaredEnvironment(spec);
    expect(compiled.capabilities).toEqual(spec.capabilities);
    expect(compiled.capabilities).not.toContain("network:fetch");
    expect(() =>
      compileDeclaredEnvironment({
        ...spec,
        compiledFrom: "inferred" as WorkerEnvironmentSpec["compiledFrom"],
      }),
    ).toThrow(/declared/i);
  });

  it("routes spreadsheet.create as DIRECT_TOOL and python.execute as SANDBOX", () => {
    expect(substrateFor("spreadsheet.create")).toBe("DIRECT_TOOL");
    expect(substrateFor("python.execute")).toBe("SANDBOX");
    expect(substrateFor("network.fetch")).toBe("BROWSER");
  });

  it("allows declared sandbox python and denies it when the capability is missing", () => {
    const granted = defaultKnowledgeWorkCapabilities("/tmp/ws");
    expect(granted.granted).toContain(SANDBOX_EXECUTE_CAPABILITY);
    expect(
      evaluatePolicy(request("python.execute", { source: "print(1)" }), granted).decision,
    ).toBe("allow");

    const stripped = defaultKnowledgeWorkCapabilities("/tmp/ws");
    stripped.granted = stripped.granted.filter((item) => item !== SANDBOX_EXECUTE_CAPABILITY);
    const denied = evaluatePolicy(request("python.execute", { source: "print(1)" }), stripped);
    expect(denied.decision).toBe("deny");
    expect(denied.reason).toMatch(/code:execute:sandbox|not granted/i);
  });

  it("denies a cross-task file and an undeclared fetch without asking the model", () => {
    const capabilities = defaultKnowledgeWorkCapabilities("/tmp/ws");
    const cross = evaluatePolicy(
      request("workspace.read_file", { path: "tsk_other/sources/secret.txt" }),
      capabilities,
    );
    expect(cross.decision).toBe("deny");
    expect(cross.reason).toMatch(/cross-task/i);

    const fetch = evaluatePolicy(
      request("network.fetch", { url: "https://news.example/search" }),
      capabilities,
    );
    expect(fetch.decision).toBe("deny");
  });

  it("runs sandbox python inside the task environment and cannot read /etc/passwd on unshare-mount", () => {
    const store = tempStore();
    const durable = store.workspaceRoot("tsk_sandbox");
    mkdirSync(join(durable, "sources"), { recursive: true });
    writeFileSync(join(durable, "sources", "ok.txt"), "in-scope");
    const isolation = selectExecutionProvider().create({
      taskId: "tsk_sandbox",
      durableRoot: durable,
    });
    isolation.workspace().writeBytes("findings.json", JSON.stringify({ companies: [{ name: "Acme" }] }));
    const spec = compileDeclaredEnvironment(
      declareWorkerEnvironment({
        assignmentId: "tsk_sandbox",
        granted: [SANDBOX_EXECUTE_CAPABILITY],
        denied: [],
      }),
    );
    const workerEnv = composeWorkerEnvironment(spec, isolation);
    expect(workerEnv.substrates).toContain("SANDBOX");

    const counted = executePythonSandbox(
      isolation.workspace(),
      [
        "import json",
        "from pathlib import Path",
        "findings = json.loads(Path('findings.json').read_text())",
        "print(len(findings['companies']))",
      ].join("\n"),
      isolation.spawn,
    );
    expect(counted.ok).toBe(true);
    expect(String(counted.data?.stdout ?? "")).toMatch(/1/);

    const probe = executePythonSandbox(
      isolation.workspace(),
      [
        "from pathlib import Path",
        "p = Path('/etc/passwd')",
        "print('readable' if p.exists() else 'blocked')",
      ].join("\n"),
      isolation.spawn,
    );
    if (isolation.kind === "unshare-mount") {
      expect(probe.ok).toBe(true);
      expect(String(probe.data?.stdout ?? "")).toMatch(/blocked/);
    }
    isolation.destroy();
    expect(workerEnv.markDestroyed().status).toBe("destroyed");
    expect(existsSync(isolation.root)).toBe(false);
  });

  it("dogfood Harbor uses both substrates, records WorkerEnvironment, and still denies cross-task", async () => {
    const store = tempStore();
    const { task } = await runSampleTask(store);
    expect(task.status).toBe("awaiting_review");
    expect(task.quality?.deliveryScore).toBe(1);
    expect(task.brief.workerId).toBe("wkr_knowledge");
    expect(task.brief.capabilityManifestId).toMatch(/^cmf_/);
    expect(task.environment?.spec.compiledFrom).toBe("declared");
    expect(task.environment?.spec.workerId).toBe("wkr_knowledge");
    expect(task.environment?.substrates).toEqual(expect.arrayContaining(["DIRECT_TOOL", "SANDBOX"]));
    expect(task.environment?.status).toBe("destroyed");
    expect(task.identity?.granted).toContain(SANDBOX_EXECUTE_CAPABILITY);
    expect(task.identity?.granted).toContain("spreadsheet:create");

    const audit = store.readAudit(task.brief.id);
    const spreadsheet = audit.find(
      (event) => event.tool === "spreadsheet.create" && event.action === "policy.decide",
    );
    expect(spreadsheet?.decision).toBe("allow");
    const python = audit.find(
      (event) => event.tool === "python.execute" && event.action === "policy.decide",
    );
    expect(python?.decision).toBe("allow");
    expect(
      audit.some(
        (event) => event.decision === "deny" && /cross-task/i.test(String(event.details.reason)),
      ),
    ).toBe(true);

    const verify = join(store.workspaceRoot(task.brief.id), "artifacts/sandbox-verify.json");
    expect(existsSync(verify)).toBe(true);
    expect(existsSync(join(store.workspaceRoot(task.brief.id), "artifacts/sandbox/result.json"))).toBe(
      true,
    );
  }, 60_000);

  it("still finishes a generic research pack through the same interfaces", async () => {
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
    expect(task.environment?.substrates).toContain("DIRECT_TOOL");
    expect(task.environment?.substrates).toContain("SANDBOX");
    expect(task.isolation?.status).toBe("destroyed");
  }, 60_000);
});
