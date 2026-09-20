import { id } from "@aether/contracts";
import type { AgentIntent, ActionRequest } from "@aether/contracts";

const FORBIDDEN_ARG_KEYS = new Set(["grant", "grantId", "grants", "granted", "decision"]);

/**
 * Planner-originated intents may only carry tool + args.
 * requestedBy is forced to agent. Grants and decisions are dropped.
 */
export function sanitizePlannerIntent(intent: AgentIntent): AgentIntent {
  if (intent.type === "finish") {
    return { type: "finish", summary: String(intent.summary ?? "") };
  }
  const raw = intent.request as ActionRequest & Record<string, unknown>;
  return {
    type: "request",
    request: {
      id: typeof raw.id === "string" && raw.id ? raw.id : id("req"),
      taskId: String(raw.taskId ?? ""),
      tool: String(raw.tool ?? ""),
      args: plainArgs(raw.args),
      requestedBy: "agent",
      rationale: typeof raw.rationale === "string" ? raw.rationale : undefined,
    },
  };
}

/** Client-supplied /api/v1 request lists enter here. No planner. No grants. */
export function sanitizeDeclaredRequests(requests: ActionRequest[], taskId: string): ActionRequest[] {
  return requests.map((raw) => {
    const intent = sanitizePlannerIntent({
      type: "request",
      request: { ...raw, taskId },
    });
    if (intent.type !== "request") {
      throw new Error("Declared request list may only contain tool intents.");
    }
    return { ...intent.request, taskId, requestedBy: "agent" };
  });
}

function plainArgs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const parsed = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    for (const key of Object.keys(parsed)) {
      if (FORBIDDEN_ARG_KEYS.has(key)) delete parsed[key];
    }
    return parsed;
  } catch {
    return {};
  }
}
