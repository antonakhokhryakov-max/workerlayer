import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { CommandRunner } from "./isolation";
import type { TaskWorkspace } from "./workspace";

const here = dirname(fileURLToPath(import.meta.url));

/** Approved destinations served from this repo. Not the open web. */
export const APPROVED_SOURCE_FIXTURES: Record<string, string> = {
  "https://notes.fir-ridge.example/profile": join(
    here,
    "../../fixtures/approved-web/fir-ridge-profile.md",
  ),
  "https://notes.lakeshore.example/mossline-customers": join(
    here,
    "../../fixtures/approved-web/mossline-customers.md",
  ),
};

export function fixtureForApprovedUrl(url: string): string | undefined {
  return APPROVED_SOURCE_FIXTURES[url];
}

function safeWebName(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/[^a-z0-9.-]+/gi, "-");
    const leaf = (parsed.pathname.split("/").filter(Boolean).pop() ?? "note")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .slice(0, 40);
    return `${host}-${leaf || "note"}`;
  } catch {
    return "approved-note";
  }
}

export function fetchApprovedDestination(
  workspace: TaskWorkspace,
  url: string,
  runner?: CommandRunner,
): {
  url: string;
  path: string;
  text: string;
  bytes: number;
  source: "approved-fixture" | "http";
  kind: "file";
} {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Only http(s) destinations can be fetched.");
  }

  const relative = `artifacts/approved-web/${safeWebName(url)}.txt`;
  const fixture = fixtureForApprovedUrl(url);
  if (fixture && existsSync(fixture)) {
    const text = readFileSync(fixture, "utf8");
    workspace.writeBytes(relative, text);
    return {
      url,
      path: relative,
      text,
      bytes: text.length,
      source: "approved-fixture",
      kind: "file",
    };
  }

  const dest = workspace.resolve(relative);
  const run: CommandRunner =
    runner ??
    ((command, args, options) =>
      spawnSync(command, args, {
        encoding: "utf8",
        cwd: options?.cwd,
        maxBuffer: options?.maxBuffer ?? 2 * 1024 * 1024,
      }));
  const pulled = run("curl", ["-fsSL", "--max-time", "12", "-o", dest, url]);
  if (pulled.status !== 0) {
    throw new Error(pulled.stderr || `Allowlisted fetch failed for ${url}.`);
  }
  const text = workspace.readBytes(relative).toString("utf8");
  return {
    url,
    path: relative,
    text,
    bytes: text.length,
    source: "http",
    kind: "file",
  };
}
