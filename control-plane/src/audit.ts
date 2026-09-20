import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AuditEvent } from "@aether/contracts";
import { id, nowIso } from "@aether/contracts";

export class AuditLog {
  constructor(private readonly filePath: string) {}

  record(
    event: Omit<AuditEvent, "id" | "timestamp"> &
      Partial<Pick<AuditEvent, "id" | "timestamp">>,
  ): AuditEvent {
    const full: AuditEvent = {
      id: event.id ?? id("aud"),
      timestamp: event.timestamp ?? nowIso(),
      taskId: event.taskId,
      actor: event.actor,
      action: event.action,
      decision: event.decision,
      tool: event.tool,
      details: event.details,
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    appendFileSync(this.filePath, `${JSON.stringify(full)}\n`, "utf8");
    return full;
  }

  list(): AuditEvent[] {
    if (!existsSync(this.filePath)) return [];
    return readFileSync(this.filePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEvent);
  }
}
