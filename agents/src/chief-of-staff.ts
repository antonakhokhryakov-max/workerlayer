import type { ActionRequest, AgentIntent, HandledAction, TaskBrief, WorkPlan } from "@aether/contracts";
import { id } from "@aether/contracts";
import type { Finding } from "@aether/contracts";

export type StaffScenario = "weekly" | "investor";

/**
 * Scenario comes from this Task's CapabilityManifest (registered tools), not a
 * naive "investor" substring. Weekly notes say "do not draft the investor update"
 * and would otherwise be misclassified.
 */
export function detectStaffScenario(task: TaskBrief): StaffScenario {
  const tools = task.registeredTools ?? [];
  const meetingPrep = tools.find((tool) => tool.name === "staff.meeting_prep");
  if (meetingPrep?.policy === "allow") return "weekly";
  if (meetingPrep?.policy === "deny") return "investor";
  const investorUpdate = tools.find((tool) => tool.name === "staff.investor_update");
  if (investorUpdate?.policy === "allow") return "investor";
  if (investorUpdate?.policy === "deny") return "weekly";
  if (task.sourceFiles.some((file) => /^investor/i.test(file.name))) return "investor";
  return "weekly";
}

/**
 * Instinct-for-X vertical: a startup chief of staff.
 * Requests registered staff.* tools. Does not authorize. Does not provision environments.
 */
export class ChiefOfStaffWorker {
  planState?: WorkPlan;
  findings: Finding[] = [];
  company = "North Dock";
  summary?: string;
  notes = "";
  read = false;
  wrotePrimary = false;
  wroteSecondary = false;
  deniedOtherScenario = false;
  deniedSensitive = false;
  scenario: StaffScenario = "weekly";

  plan(task: TaskBrief): WorkPlan {
    this.scenario = detectStaffScenario(task);
    this.planState = {
      summary:
        this.scenario === "weekly"
          ? `Prep weekly leadership sync for ${this.company}.`
          : `Draft investor update for ${this.company}.`,
      steps:
        this.scenario === "weekly"
          ? [
              { id: "read", title: "Read this week's notes", detail: "Request staff.read.", status: "pending" },
              { id: "priorities", title: "Set weekly priorities", detail: "Request staff.priorities.", status: "pending" },
              { id: "prep", title: "Write meeting prep", detail: "Request staff.meeting_prep.", status: "pending" },
              { id: "questions", title: "List open questions", detail: "Request staff.open_questions.", status: "pending" },
              { id: "wrong", title: "Refuse investor drafting", detail: "Request staff.investor_update so this Task's manifest can deny it.", status: "pending" },
              { id: "cross", title: "Refuse another assignment's files", detail: "Request a cross-task read.", status: "pending" },
            ]
          : [
              { id: "read", title: "Read investor notes", detail: "Request staff.read.", status: "pending" },
              { id: "update", title: "Draft the investor update", detail: "Request staff.investor_update.", status: "pending" },
              { id: "decisions", title: "Record the decision log", detail: "Request staff.decision_log.", status: "pending" },
              { id: "wrong", title: "Refuse internal meeting prep", detail: "Request staff.meeting_prep so this Task's manifest can deny it.", status: "pending" },
              { id: "payroll", title: "Refuse payroll", detail: "Request staff.payroll — not granted on this Worker.", status: "pending" },
            ],
    };
    return this.planState;
  }

  observe(handled: HandledAction): void {
    const data = handled.result.data ?? {};
    if (handled.request.tool === "staff.read") {
      this.read = handled.result.ok;
      this.notes = typeof data.content === "string" ? data.content : this.notes;
      this.mark("read", handled.result.ok ? "done" : "blocked");
    }
    if (handled.request.tool === "staff.priorities" && handled.result.ok) {
      this.wrotePrimary = true;
      this.mark("priorities", "done");
      this.note("Priorities", "Weekly priorities written from attached notes.", String(data.path ?? "weekly-priorities.md"));
    }
    if (handled.request.tool === "staff.meeting_prep") {
      if (handled.decision.decision === "deny") {
        this.deniedOtherScenario = true;
        this.mark("wrong", "done");
      } else if (handled.result.ok) {
        this.wroteSecondary = true;
        this.mark("prep", "done");
        this.note("Meeting", "Leadership sync prep written.", String(data.path ?? "meeting-prep.md"));
      }
    }
    if (handled.request.tool === "staff.open_questions" && handled.result.ok) {
      this.wroteSecondary = true;
      this.mark("questions", "done");
      this.note("Questions", "Open questions listed.", String(data.path ?? "open-questions.md"));
    }
    if (handled.request.tool === "staff.investor_update") {
      if (handled.decision.decision === "deny") {
        this.deniedOtherScenario = true;
        this.mark("wrong", "done");
      } else if (handled.result.ok) {
        this.wrotePrimary = true;
        this.mark("update", "done");
        this.note("Investor", "Investor update drafted from attached notes.", String(data.path ?? "investor-update.md"));
      }
    }
    if (handled.request.tool === "staff.decision_log" && handled.result.ok) {
      this.wroteSecondary = true;
      this.mark("decisions", "done");
      this.note("Decisions", "Decision log recorded.", String(data.path ?? "decision-log.md"));
    }
    if (handled.request.tool === "workspace.read_file" && handled.decision.decision === "deny") {
      this.deniedSensitive = true;
      this.mark("cross", "done");
    }
    if (handled.request.tool === "staff.payroll") {
      this.deniedSensitive = handled.decision.decision === "deny";
      this.mark("payroll", "done");
    }
  }

  async nextIntent(task: TaskBrief): Promise<AgentIntent> {
    const request = (
      tool: ActionRequest["tool"],
      args: Record<string, unknown>,
      rationale: string,
    ): ActionRequest => ({
      id: id("req"),
      taskId: task.id,
      tool,
      args,
      requestedBy: "agent",
      rationale,
    });

    const source = task.sourceFiles[0]?.name ?? "notes.md";
    if (!this.read) {
      return {
        type: "request",
        request: request("staff.read", { path: source }, "Read the notes attached to this Task."),
      };
    }

    if (this.scenario === "weekly") {
      if (!this.wrotePrimary) {
        return {
          type: "request",
          request: request(
            "staff.priorities",
            { path: "weekly-priorities.md", text: this.prioritiesDoc() },
            "Write this week's priorities from the attached notes.",
          ),
        };
      }
      if (!this.findings.some((item) => item.category === "Meeting")) {
        return {
          type: "request",
          request: request(
            "staff.meeting_prep",
            { path: "meeting-prep.md", text: this.meetingDoc() },
            "Write prep for the Thursday leadership sync.",
          ),
        };
      }
      if (!this.findings.some((item) => item.category === "Questions")) {
        return {
          type: "request",
          request: request(
            "staff.open_questions",
            { path: "open-questions.md", text: this.questionsDoc() },
            "List questions the notes do not settle.",
          ),
        };
      }
      if (!this.deniedOtherScenario) {
        return {
          type: "request",
          request: request(
            "staff.investor_update",
            { path: "investor-update.md", text: "Should not send." },
            "Draft the investor letter from the weekly pack.",
          ),
        };
      }
      if (!this.deniedSensitive) {
        return {
          type: "request",
          request: request(
            "workspace.read_file",
            { path: "tsk_other/sources/payroll.csv" },
            "Read payroll from another assignment.",
          ),
        };
      }
      return {
        type: "finish",
        summary:
          "Weekly leadership pack is ready: priorities, meeting prep, and open questions. Investor drafting and cross-task files were denied.",
      };
    }

    if (!this.wrotePrimary) {
      return {
        type: "request",
        request: request(
          "staff.investor_update",
          { path: "investor-update.md", text: this.investorDoc() },
          "Draft the investor update from the attached notes.",
        ),
      };
    }
    if (!this.wroteSecondary) {
      return {
        type: "request",
        request: request(
          "staff.decision_log",
          { path: "decision-log.md", text: this.decisionsDoc() },
          "Record decisions called out in the notes.",
        ),
      };
    }
    if (!this.deniedOtherScenario) {
      return {
        type: "request",
        request: request(
          "staff.meeting_prep",
          { path: "meeting-prep.md", text: "Should not prepare the internal agenda." },
          "Write Thursday's leadership agenda from the investor pack.",
        ),
      };
    }
    if (!this.deniedSensitive) {
      return {
        type: "request",
        request: request(
          "staff.payroll",
          { path: "payroll.csv" },
          "Pull payroll for the investor letter.",
        ),
      };
    }
    return {
      type: "finish",
      summary:
        "Investor update and decision log are ready. Internal meeting prep and payroll were denied.",
    };
  }

  isDelivered(): boolean {
    return this.read && this.wrotePrimary && this.wroteSecondary && this.deniedOtherScenario && this.deniedSensitive;
  }

  private lines(prefix: string): string[] {
    return this.notes
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith(prefix))
      .map((line) => line.slice(prefix.length).trim());
  }

  private prioritiesDoc(): string {
    const items = this.lines("P:");
    return [
      `# ${this.company} — weekly priorities`,
      "",
      ...items.map((item) => `- ${item}`),
      "",
      "Source: weekly-notes.md. Not an investor letter.",
    ].join("\n");
  }

  private meetingDoc(): string {
    const meetings = this.lines("M:");
    return [
      `# ${this.company} — leadership sync prep`,
      "",
      ...meetings.map((item) => `- ${item}`),
      "",
      "## Suggested agenda",
      "1. Oakland lease",
      "2. Field-engineer hiring",
      "3. Municipal pricing sheet",
      "4. Open questions (warehouse bays, iOS)",
    ].join("\n");
  }

  private questionsDoc(): string {
    const questions = this.lines("Q:");
    return [
      `# ${this.company} — open questions`,
      "",
      ...questions.map((item) => `- ${item}`),
      "",
      "These stay flagged. The chief of staff did not invent answers.",
    ].join("\n");
  }

  private investorDoc(): string {
    const arr = this.lines("ARR:")[0] ?? "not in the attached notes";
    const asks = this.lines("ASK:");
    return [
      `# ${this.company} — investor update`,
      "",
      `ARR: ${arr}`,
      "",
      "## What we need",
      ...asks.map((item) => `- ${item}`),
      "",
      "Drafted from investor-notes.md only. Internal leadership prep is out of scope for this Task.",
    ].join("\n");
  }

  private decisionsDoc(): string {
    const decisions = this.lines("D:");
    return [
      `# ${this.company} — decision log`,
      "",
      ...decisions.map((item) => `- ${item}`),
      "",
      "Logged from the attached notes. Not a payroll extract.",
    ].join("\n");
  }

  private note(category: string, finding: string, source: string): void {
    this.findings.push({
      category,
      finding,
      evidence: source,
      source,
      confidence: "high",
    });
  }

  private mark(id: string, status: WorkPlan["steps"][number]["status"]): void {
    if (!this.planState) return;
    this.planState = {
      ...this.planState,
      steps: this.planState.steps.map((step) => (step.id === id ? { ...step, status } : step)),
    };
  }
}
