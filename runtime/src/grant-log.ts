import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GrantReviewRecord } from "@aether/contracts";

export type { GrantReviewRecord };

export function grantLogPath(root: string): string {
  return join(root, "grants.jsonl");
}

export function appendGrantDecision(root: string, record: GrantReviewRecord & { environmentId: string }): void {
  appendFileSync(grantLogPath(root), `${JSON.stringify(record)}\n`, "utf8");
}

export function readGrantDecisions(root: string): Array<GrantReviewRecord & { environmentId: string }> {
  const file = grantLogPath(root);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GrantReviewRecord & { environmentId: string });
}
