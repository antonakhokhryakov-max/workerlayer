import { createHash } from "node:crypto";
import {
  PRODUCT_ALPHA_LABEL,
  PRODUCT_LEFTOVER_DENY,
  PRODUCT_SKETCH_REVIEW,
  id,
  type RegisteredTool,
  type SuggestedTool,
  type WorkerEnvironmentSpec,
} from "@aether/contracts";
import { compileDeclaredEnvironment } from "@aether/control-plane";
import { DeveloperApiError } from "./developer-api";

export interface CapabilityProposal {
  id: string;
  hash: string;
  goal: string;
  /** Always false. A proposal never grants. Never a Manifest. */
  granted: false;
  status: "sketch";
  suggestedTools: SuggestedTool[];
  review: string;
  note: string;
  alpha: string;
}

const NOTE =
  "Sketch / suggested tools only. Nothing is granted. Never writes a Manifest. A human must Grant selected tools. Untouched sketch rows stay out and stay DENY-able. The EnvironmentCompiler still copies a declared spec. Compute stays sticky per Task — this sketch does not pick Docker vs unshare or invent mounts.";

const DENY_WORDS = ["payroll", "secrets", "secret", "export", "fax", "password"] as const;
const ALLOW_WORDS = ["read", "write", "stamp", "echo", "hold", "note"] as const;

/**
 * Thin EnvironmentCompiler: propose is a sketch; compile copies a declared spec.
 * Propose never writes a CapabilityManifest, never grants, never creates an environment.
 * grantFromProposal is a hard no. A human grant is POST /api/v1/grant with selected tools.
 */
export class EnvironmentCompiler {
  propose(goal: unknown): CapabilityProposal {
    return proposeFromGoal(goal);
  }

  compileDeclared(spec: WorkerEnvironmentSpec): WorkerEnvironmentSpec {
    return compileDeclaredEnvironment(spec);
  }

  grantFromProposal(_proposal: CapabilityProposal): never {
    throw new DeveloperApiError(
      400,
      "A proposal is not a grant. Pass selected tools and confirm: true to POST /api/v1/grant after a human review.",
    );
  }
}

export const environmentCompiler = new EnvironmentCompiler();

export function hashSketch(goal: string, tools: SuggestedTool[]): string {
  const canonical = JSON.stringify({
    goal,
    tools: tools.map((tool) => ({ name: tool.name, capability: tool.capability, policy: tool.policy })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function proposeFromGoal(goal: unknown): CapabilityProposal {
  const text = typeof goal === "string" ? goal.trim() : "";
  if (!text) {
    throw new DeveloperApiError(400, "goal is required — the assignment text to propose from.");
  }
  const suggested = new Map<string, SuggestedTool>();

  for (const word of DENY_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      const stem = word.replace(/s$/, "");
      const name = `task.${stem}`;
      suggested.set(name, {
        name,
        capability: `task:${stem}`,
        policy: "deny",
        reason: `Assignment mentioned “${word}”. Suggested DENY — you still choose.`,
      });
    }
  }
  for (const word of ALLOW_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      const name = `task.${word}`;
      if (suggested.has(name)) continue;
      suggested.set(name, {
        name,
        capability: `task:${word}`,
        policy: "allow",
        reason: `Assignment mentioned “${word}”. Suggested ALLOW — you still choose.`,
      });
    }
  }

  const suggestedTools = Object.freeze([...suggested.values()]) as SuggestedTool[];
  const sketchId = id("skh");
  return Object.freeze({
    id: sketchId,
    hash: hashSketch(text, suggestedTools),
    goal: text,
    granted: false,
    status: "sketch",
    suggestedTools,
    review: PRODUCT_SKETCH_REVIEW,
    note: NOTE,
    alpha: PRODUCT_ALPHA_LABEL,
  });
}

export interface HumanGrantSelection {
  worker: string;
  tools: unknown[];
  proposalGoal?: string;
  sketchedTools: SuggestedTool[];
  sketchedToolNames: string[];
  sketchId?: string;
  sketchHash?: string;
}

/**
 * Require a human-selected tool list plus confirm: true.
 * Never copies the whole sketch. Does not create an environment or Manifest.
 */
export function requireHumanGrantSelection(body: Record<string, unknown>): HumanGrantSelection {
  if (body.auto === true || body.approveAll === true) {
    throw new DeveloperApiError(400, "No auto-grant and no Approve all. Grant selected tools only.");
  }
  if (
    body.standing === true ||
    body.workerDefault === true ||
    body.scope === "worker" ||
    body.scope === "worker-default"
  ) {
    throw new DeveloperApiError(
      400,
      "Grant is Task-scoped. This Alpha does not offer a standing ALLOW or Worker-default template across Tasks.",
    );
  }
  if (body.confirm !== true) {
    throw new DeveloperApiError(
      400,
      "Set confirm: true after you choose tools. The API key is identity only — it does not grant. Desk or session human act required.",
    );
  }
  if (!Array.isArray(body.tools) || body.tools.length === 0) {
    throw new DeveloperApiError(
      400,
      "Send the tools you choose to grant. Passing only a proposal auto-grants nothing.",
    );
  }
  const worker = typeof body.worker === "string" ? body.worker.trim() : "";
  if (!worker) {
    throw new DeveloperApiError(400, "worker is required — a short name for this agent.");
  }
  const proposal = body.proposal;
  let proposalGoal: string | undefined;
  const sketchedTools: SuggestedTool[] = [];
  let sketchId: string | undefined;
  let sketchHash: string | undefined;
  if (proposal && typeof proposal === "object" && !Array.isArray(proposal)) {
    const record = proposal as Record<string, unknown>;
    if (typeof record.goal === "string" && record.goal.trim()) proposalGoal = record.goal.trim();
    if (typeof record.id === "string" && record.id.trim()) sketchId = record.id.trim();
    if (typeof record.hash === "string" && record.hash.trim()) sketchHash = record.hash.trim();
    if (Array.isArray(record.suggestedTools)) {
      for (const item of record.suggestedTools) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        if (typeof row.name !== "string" || typeof row.capability !== "string") continue;
        const policy = row.policy;
        if (policy !== "allow" && policy !== "deny" && policy !== "require_approval") continue;
        sketchedTools.push({
          name: row.name,
          capability: row.capability,
          policy,
          reason: typeof row.reason === "string" ? row.reason : PRODUCT_LEFTOVER_DENY,
        });
      }
    }
  }
  return {
    worker,
    tools: body.tools,
    proposalGoal,
    sketchedTools,
    sketchedToolNames: sketchedTools.map((tool) => tool.name),
    sketchId,
    sketchHash,
  };
}

export function leftoverDenialReason(): string {
  return PRODUCT_LEFTOVER_DENY;
}

export type { RegisteredTool };
