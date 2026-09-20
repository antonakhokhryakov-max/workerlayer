import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AetherPlatform,
  getWorkerRegistration,
  registeredWorkerKinds,
  unregisterWorker,
} from "@aether/runtime";
import { tempStore } from "./helpers";

const KIND = "echo_clerk";

afterEach(() => {
  unregisterWorker(KIND);
});

describe("Worker registry", () => {
  it("registers the developer worker only; Harbor, Claims, and CoS live in packages", () => {
    expect(registeredWorkerKinds()).toEqual(
      expect.arrayContaining(["knowledge", "claims", "chief_of_staff", "developer"]),
    );
    expect(getWorkerRegistration("chief_of_staff")?.name).toBe("North Dock chief of staff");
    const builtins = readFileSync(join(process.cwd(), "runtime/src/builtins.ts"), "utf8");
    expect(builtins).toMatch(/kind: "developer"/);
    expect(builtins).not.toMatch(/kind: "knowledge"/);
    expect(builtins).not.toMatch(/kind: "claims"/);
    expect(builtins).not.toMatch(/kind: "chief_of_staff"/);
    expect(builtins).not.toMatch(/KnowledgeWorker|ClaimsWorker|ChiefOfStaffWorker/);
  });

  it("kernel, platform, and builtins do not list a third-party kind", () => {
    const files = [
      "runtime/src/kernel.ts",
      "runtime/src/platform.ts",
      "runtime/src/workers.ts",
      "runtime/src/builtins.ts",
    ];
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).not.toMatch(/workerKind\s*===/);
      expect(src).not.toMatch(/echo_clerk/);
      expect(src).not.toMatch(/vertical-echo/);
    }
  });

  it("desk loader maps first-party packages without builtins.ts", () => {
    const loader = readFileSync(join(process.cwd(), "src/lib/load-host-verticals.ts"), "utf8");
    expect(loader).toMatch(/vertical-knowledge/);
    expect(loader).toMatch(/vertical-claims/);
    expect(loader).toMatch(/vertical-staff/);
    expect(loader).toMatch(/vertical-echo/);
    expect(existsSync(join(process.cwd(), "packages/vertical-knowledge/src/index.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "packages/vertical-claims/src/index.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "packages/vertical-staff/src/index.ts"))).toBe(true);
  });

  it("refuses an unregistered WorkerKind", () => {
    const plat = new AetherPlatform(tempStore());
    expect(() => plat.ensureWorker("not_a_vertical")).toThrow(/registerWorker/i);
    expect(existsSync(join(process.cwd(), "runtime/src/builtins.ts"))).toBe(true);
  });

  it("treats Echo as the default second worker from an external package", () => {
    const form = readFileSync(join(process.cwd(), "src/components/assign-form.tsx"), "utf8");
    const echoAt = form.indexOf("Echo clerk");
    const claimsAt = form.indexOf("Cedarline Claims");
    expect(echoAt).toBeGreaterThan(-1);
    expect(claimsAt).toBeGreaterThan(echoAt);
    expect(form).toMatch(/OEM second worker/);
    expect(form).toMatch(/packages\/vertical-echo/);
    expect(form).toMatch(/docs\/OEM\.md/);
    expect(form).toMatch(/not the\s+product/);
    const setup = readFileSync(join(process.cwd(), "tests/setup-first-party-verticals.ts"), "utf8");
    expect(setup).toMatch(/loadVerticals/);
    expect(setup).not.toMatch(/vertical-knowledge/);
    expect(setup).not.toMatch(/vertical-claims/);
    expect(setup).not.toMatch(/vertical-staff/);
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/Echo clerk/);
    expect(readme).toMatch(/packages\/vertical-echo/);
    expect(readme).toMatch(/docs\/OEM\.md/);
    const oem = readFileSync(join(process.cwd(), "docs/OEM.md"), "utf8");
    expect(oem).toMatch(/do \*\*not\*\* edit `runtime\/src\/builtins\.ts`/i);
    expect(oem).toMatch(/Outsider registerWorker checklist/);
    expect(oem).toMatch(/notes\.read/);
    expect(oem).toMatch(/aether\.verticals\.json/);
    const config = readFileSync(join(process.cwd(), "aether.verticals.json"), "utf8");
    expect(config.indexOf("vertical-echo")).toBeLessThan(config.indexOf("vertical-knowledge"));
    const builtins = readFileSync(join(process.cwd(), "runtime/src/builtins.ts"), "utf8");
    expect(builtins).toMatch(/Do not register Echo/);
    const echoRoute = readFileSync(join(process.cwd(), "src/app/api/tasks/echo/route.ts"), "utf8");
    expect(echoRoute).toMatch(/Do not edit builtins\.ts/);
    expect(oem).toMatch(/FAQ/);
    expect(oem).toMatch(/config-only/);
    expect(oem).toMatch(/Do I need Harbor fixtures/);
    expect(oem).toMatch(/tsx/);
    const loader = readFileSync(join(process.cwd(), "src/lib/load-host-verticals.ts"), "utf8");
    expect(loader).toMatch(/Do not edit runtime\/src\/builtins\.ts/);
    expect(loader).toMatch(/Config-only load failed/);
    expect(loader).toMatch(/retries with tsx/);
    const loadVerticals = readFileSync(join(process.cwd(), "runtime/src/load-verticals.ts"), "utf8");
    expect(loadVerticals).toMatch(/importVerticalModule/);
    expect(loadVerticals).toMatch(/tsx\/esm/);
  });
});
