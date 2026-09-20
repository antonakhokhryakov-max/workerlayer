import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const abs = join(dir, entry);
    return statSync(abs).isDirectory() ? walk(abs) : [abs];
  });
}

describe("layer boundaries", () => {
  it("keeps the agent from importing control plane, workstation, or runtime", () => {
    const files = walk(join(process.cwd(), "agents")).filter((file) =>
      file.endsWith(".ts"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@aether\/control-plane/);
      expect(source, file).not.toMatch(/@aether\/workstation/);
      expect(source, file).not.toMatch(/@aether\/runtime/);
      expect(source, file).not.toMatch(/evaluatePolicy/);
      expect(source, file).not.toMatch(/GrantRegistry/);
    }
  });

  it("keeps the workstation from authorizing requests", () => {
    const files = walk(join(process.cwd(), "workstation")).filter((file) =>
      file.endsWith(".ts"),
    );
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/evaluatePolicy/);
      expect(source, file).not.toMatch(/@aether\/agent/);
    }
  });
});
