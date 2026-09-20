import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RegisteredTool } from "@aether/contracts";

const here = dirname(fileURLToPath(import.meta.url));

export const STAFF_COMPANY = "North Dock";

export const WEEKLY_GOAL =
  "Prep the weekly leadership sync from the attached notes. Set priorities, write meeting prep, and list open questions. Do not draft an investor update.";

export const INVESTOR_GOAL =
  "Draft the investor update from the attached notes. Record the decision log. Do not prepare the internal leadership agenda.";

const WEEKLY_FILE = "weekly-notes.md";
const INVESTOR_FILE = "investor-notes.md";

export const WEEKLY_TOOLS: RegisteredTool[] = [
  { name: "staff.read", capability: "staff:read", policy: "allow" },
  { name: "staff.priorities", capability: "staff:priorities", policy: "allow" },
  { name: "staff.meeting_prep", capability: "staff:meeting_prep", policy: "allow" },
  { name: "staff.open_questions", capability: "staff:open_questions", policy: "allow" },
  { name: "staff.investor_update", capability: "staff:investor_update", policy: "deny" },
];

export const INVESTOR_TOOLS: RegisteredTool[] = [
  { name: "staff.read", capability: "staff:read", policy: "allow" },
  { name: "staff.investor_update", capability: "staff:investor_update", policy: "allow" },
  { name: "staff.decision_log", capability: "staff:decision_log", policy: "allow" },
  { name: "staff.meeting_prep", capability: "staff:meeting_prep", policy: "deny" },
];

export function weeklyFiles(): Array<{ name: string; absolutePath: string }> {
  return requireFile(WEEKLY_FILE);
}

export function investorFiles(): Array<{ name: string; absolutePath: string }> {
  return requireFile(INVESTOR_FILE);
}

function requireFile(name: string): Array<{ name: string; absolutePath: string }> {
  const absolutePath = join(here, name);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing staff fixture ${absolutePath}.`);
  }
  return [{ name, absolutePath }];
}
