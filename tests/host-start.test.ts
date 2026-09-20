import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Mac mini host start contract", () => {
  const hostStart = readFileSync(join(process.cwd(), "docs/HOST-START.md"), "utf8");
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  it("locks cwd, install chain, and :43147 listen", () => {
    expect(hostStart).toMatch(/^# WorkerLayer host start \(Mac mini\)/m);
    expect(hostStart).toMatch(/~\/Developer\/workerlayer-origin/);
    expect(hostStart).toMatch(/~\/Developer\/workerlayer/);
    expect(hostStart).toMatch(/pnpm install && pnpm fixtures && pnpm test && pnpm dev/);
    expect(hostStart).toMatch(/brew install pnpm poppler ffmpeg tesseract/);
    expect(hostStart).toMatch(/http:\/\/127\.0\.0\.1:43147/);
    expect(hostStart).toMatch(/Desk `:8787` is \*\*not\*\* the host/);
    expect(pkg.scripts.dev).toBe("next dev -p 43147 --hostname 127.0.0.1");
    expect(pkg.scripts.start).toBe("next start -p 43147 --hostname 127.0.0.1");
    expect(pkg.scripts.fixtures).toMatch(/fixtures\/harbor-and-pine\/generate\.ts/);
    expect(pkg.scripts.test).toBe("vitest run");
  });

  it("keeps compute on the mini and product contracts intact", () => {
    expect(hostStart).toMatch(/Workers \/ `startTask` \/ Manifest exec/);
    expect(hostStart).toMatch(/Do NOT set WORKERLAYER_HOST_URL/);
    expect(hostStart).toMatch(/Propose-only/);
    expect(hostStart).toMatch(/Identity ≠ auth/);
    expect(hostStart).toMatch(/Sticky compute/);
    expect(hostStart).toMatch(/grantFromProposal/);
    expect(hostStart).toMatch(/desk-session/);
    expect(hostStart).not.toMatch(/Approve all/);
  });
});
