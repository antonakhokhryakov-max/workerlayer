import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  AetherPlatform,
  getWorkerRegistration,
  loadVerticals,
  packName,
  readVerticalsConfig,
  resolveVerticalEntry,
  unregisterWorker,
} from "@aether/runtime";
import { tempStore } from "./helpers";

const KIND = "echo_clerk";
const PACKAGE_DIR = join(process.cwd(), "packages/vertical-echo");

afterEach(() => {
  unregisterWorker(KIND);
});

describe("external vertical package", () => {
  it("is not imported from builtins.ts", () => {
    const builtins = readFileSync(join(process.cwd(), "runtime/src/builtins.ts"), "utf8");
    expect(builtins).not.toMatch(/vertical-echo/);
    expect(builtins).not.toMatch(/echo_clerk/);
    expect(builtins).not.toMatch(/EchoClerk/);
    expect(builtins).not.toMatch(/vertical-knowledge/);
    expect(builtins).not.toMatch(/vertical-claims/);
    expect(builtins).not.toMatch(/vertical-staff/);
  });

  it("resolves the package entry from package.json without a kernel edit", () => {
    const entry = resolveVerticalEntry("./packages/vertical-echo", process.cwd());
    expect(entry).toBe(join(PACKAGE_DIR, "src/index.ts"));
    expect(existsSync(entry)).toBe(true);
  });

  it("reads aether.verticals.json", () => {
    const config = readVerticalsConfig(process.cwd());
    expect(config.verticals[0]).toBe("./packages/vertical-echo");
    expect(config.verticals).toContain("./packages/vertical-echo");
    expect(config.verticals).toContain("./packages/vertical-knowledge");
    expect(config.verticals).toContain("./packages/vertical-claims");
    expect(config.verticals).toContain("./packages/vertical-staff");
  });

  it("loads from config path and runs allow, deny, and teardown", async () => {
    const { entries } = await loadVerticals({
      paths: ["./packages/vertical-echo"],
      root: process.cwd(),
    });
    expect(entries.some((entry) => entry.endsWith("packages/vertical-echo/src/index.ts"))).toBe(true);

    const registration = getWorkerRegistration(KIND);
    expect(registration?.name).toBe("Echo clerk");
    expect(registration?.defaultTools?.some((tool) => tool.name === "echo.write")).toBe(true);

    const store = tempStore();
    const plat = new AetherPlatform(store);
    const worker = plat.ensureWorker(KIND);
    expect(worker.id).toBe("wkr_echo_clerk");

    const queued = plat.createTask(worker.id, {
      goal: registration!.defaultGoal ?? "Echo the attached line.",
      fileContents: [{ name: "note.md", bytes: "ping" }],
      registeredTools: registration!.defaultTools,
    });
    expect(queued.brief.workerKind).toBe(KIND);

    const { task } = await plat.runTask(queued.brief.id);
    expect(task.status).toBe("awaiting_review");
    expect(packName(task)).toBe("other");
    expect(task.environment?.status).toBe("destroyed");
    expect(existsSync(join(store.workspaceRoot(task.brief.id), "artifacts/echo.md"))).toBe(true);
    expect(readFileSync(join(store.workspaceRoot(task.brief.id), "artifacts/echo.md"), "utf8")).toMatch(
      /packaged vertical/,
    );

    const audit = store.readAudit(task.brief.id);
    expect(
      audit.some(
        (event) =>
          event.tool === "echo.write" && event.action === "policy.decide" && event.decision === "allow",
      ),
    ).toBe(true);
    expect(
      audit.some(
        (event) =>
          event.tool === "echo.secrets" && event.action === "policy.decide" && event.decision === "deny",
      ),
    ).toBe(true);
    expect(audit.some((event) => event.action === "environment.destroyed")).toBe(true);
  });

  it("loads from a config file the host owns, not builtins.ts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "aether-verticals-"));
    const configFile = join(dir, "aether.verticals.json");
    writeFileSync(
      configFile,
      JSON.stringify({ verticals: [PACKAGE_DIR] }),
    );
    await loadVerticals({ root: dir, configFile });
    expect(getWorkerRegistration(KIND)?.name).toBe("Echo clerk");
  });

  it("rejects a missing config path", async () => {
    await expect(
      loadVerticals({ paths: ["./does-not-exist-vertical"], root: process.cwd() }),
    ).rejects.toThrow(/not found/i);
  });

  it("exposes importVerticalModule for config-only leftover loads", async () => {
    const { importVerticalModule } = await import("@aether/runtime");
    const entry = resolveVerticalEntry("./packages/vertical-echo", process.cwd());
    const mod = (await importVerticalModule(entry)) as { register?: () => void };
    expect(typeof mod.register).toBe("function");
  });
});
