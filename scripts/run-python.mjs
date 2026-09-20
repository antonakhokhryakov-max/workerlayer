#!/usr/bin/env node
/** Run a Python sample with a clear missing-python3 error. Harbor OCR is not required. */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = process.argv[2];
if (!script) {
  console.error("Usage: node scripts/run-python.mjs clients/python/example.py");
  process.exit(2);
}

const result = spawnSync("python3", [script, ...process.argv.slice(3)], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.error && "code" in result.error && result.error.code === "ENOENT") {
  console.error(
    "WorkerLayer's 15-minute path needs python3 (stdlib only). Harbor fixtures and tesseract are not required. See docs/ALPHA.md and docs/DX.md.",
  );
  process.exit(1);
}
process.exit(result.status ?? 1);
