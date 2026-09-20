import type { ActionResult } from "@aether/contracts";
import type { CommandRunner } from "./isolation";
import type { TaskWorkspace } from "./workspace";

const SCRIPT_PATH = "artifacts/sandbox/run.py";
const RESULT_PATH = "artifacts/sandbox/result.json";

export function executePythonSandbox(
  workspace: TaskWorkspace,
  source: string,
  runner: CommandRunner,
): ActionResult {
  const script = source.replace(/\r\n/g, "\n");
  workspace.writeBytes(SCRIPT_PATH, script);

  const ran = runner("python3", [SCRIPT_PATH], {
    cwd: workspace.root,
    maxBuffer: 512 * 1024,
    timeout: 8_000,
  });

  const stdout = String(ran.stdout ?? "").slice(0, 16_000);
  const stderr = String(ran.stderr ?? "").slice(0, 8_000);
  const exitCode = ran.status ?? 1;
  const payload = {
    ok: exitCode === 0,
    substrate: "SANDBOX",
    path: RESULT_PATH,
    script: SCRIPT_PATH,
    stdout,
    stderr,
    exitCode,
    error: exitCode === 0 ? undefined : stderr || ran.error?.message || "Sandbox python failed.",
  };
  workspace.writeBytes(RESULT_PATH, JSON.stringify(payload, null, 2));

  if (exitCode !== 0) {
    return {
      ok: false,
      status: "failed",
      error: payload.error,
      data: payload,
    };
  }
  return { ok: true, status: "succeeded", data: payload };
}
