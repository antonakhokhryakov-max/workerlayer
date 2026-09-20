import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  AuditLog,
  DEFAULT_APPROVAL_CAPABILITIES,
  DEFAULT_DENIED_CAPABILITIES,
  expireIdentity,
  isKnownActionName,
  uniqueCapabilities,
} from "@aether/control-plane";
import type {
  ActionRequest,
  DeveloperEnvironmentRecord,
  GrantLeftoverDenial,
  GrantReviewRecord,
  RegisteredTool,
} from "@aether/contracts";
import { PRODUCT_LEFTOVER_DENY, PRODUCT_SKETCH_REVIEW, id, nowIso } from "@aether/contracts";
import { newBrief, runDeveloperTask } from "./kernel";
import { sanitizeDeclaredRequests } from "./sanitize-intent";
import { bindBriefToWorker } from "./workers";
import { emptyReview, type StoredTask, TaskStore } from "./store";
import { appendGrantDecision, readGrantDecisions } from "./grant-log";

export class DeveloperApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DeveloperApiError";
  }
}

export interface ToolDeclaration {
  name: string;
  capability: string;
  policy: "allow" | "deny" | "require_approval";
}

export interface DeveloperTaskView {
  id: string;
  goal: string;
  status: StoredTask["status"];
  worker: string;
  environmentId: string;
  identity?: StoredTask["identity"];
  environment?: StoredTask["environment"];
  summary?: string;
  findings: StoredTask["findings"];
  artifacts: StoredTask["artifacts"];
  governance?: StoredTask["governance"];
  error?: string;
}

const TOOL_NAME = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/;
const CAPABILITY_NAME = /^[a-z][a-z0-9]*:[a-z0-9:_-]+$/;

function fail(status: number, message: string): never {
  throw new DeveloperApiError(status, message);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseToolDeclaration(raw: unknown): RegisteredTool {
  if (!raw || typeof raw !== "object") fail(400, "Each tool must be an object.");
  const record = raw as Record<string, unknown>;
  const name = asString(record.name);
  const capability = asString(record.capability);
  const policy = asString(record.policy);
  if (!name || !TOOL_NAME.test(name)) {
    fail(400, "Tool names look like notes.read — lowercase, dotted.");
  }
  if (isKnownActionName(name)) {
    fail(400, `Tool '${name}' is a first-party tool. Register your own name.`);
  }
  if (!capability || !CAPABILITY_NAME.test(capability)) {
    fail(400, "Capabilities look like notes:read.");
  }
  if (policy !== "allow" && policy !== "deny" && policy !== "require_approval") {
    fail(400, "Tool policy must be allow, deny, or require_approval.");
  }
  return { name, capability, policy };
}

function baseCapabilities(tools: RegisteredTool[]): Pick<
  DeveloperEnvironmentRecord,
  "granted" | "denied" | "requireApproval"
> {
  const fromAllow = tools.filter((tool) => tool.policy !== "deny").map((tool) => tool.capability);
  const fromDeny = tools.filter((tool) => tool.policy === "deny").map((tool) => tool.capability);
  const fromApproval = tools
    .filter((tool) => tool.policy === "require_approval")
    .map((tool) => tool.capability);
  return {
    granted: uniqueCapabilities(["files:read:task", "files:write:output", ...fromAllow]),
    denied: uniqueCapabilities([...DEFAULT_DENIED_CAPABILITIES, ...fromDeny]),
    requireApproval: uniqueCapabilities([...DEFAULT_APPROVAL_CAPABILITIES, ...fromApproval]),
  };
}

function mergeTool(existing: RegisteredTool[], next: RegisteredTool): RegisteredTool[] {
  return [...existing.filter((tool) => tool.name !== next.name), next];
}

export class DeveloperApi {
  constructor(
    private readonly store: TaskStore,
    private readonly principalId?: string,
  ) {}

  /** Scope this API to an API-key principal. The key never grants capabilities. */
  actingAs(principalId: string): DeveloperApi {
    return new DeveloperApi(this.store, principalId);
  }

  createEnvironment(input: {
    worker?: unknown;
    tools?: unknown;
    capabilities?: unknown;
    [key: string]: unknown;
  }): DeveloperEnvironmentRecord {
    if (input.proposal != null) {
      fail(
        400,
        "A proposal is not a grant. POST /api/v1/grant with selected tools and confirm: true. /propose never writes a Manifest.",
      );
    }
    const worker = asString(input.worker);
    if (!worker) fail(400, "worker is required — a short name for this agent.");
    if (worker.length > 80) fail(400, "worker name is too long.");
    const tools = Array.isArray(input.tools) ? input.tools.map(parseToolDeclaration) : [];
    const derived = baseCapabilities(tools);
    const extras = parseCapabilityLists(input.capabilities);
    const environment: DeveloperEnvironmentRecord = {
      id: id("env"),
      worker,
      status: "ready",
      tools,
      granted: uniqueCapabilities([...derived.granted, ...extras.granted]),
      denied: uniqueCapabilities([...derived.denied, ...extras.denied]),
      requireApproval: uniqueCapabilities([...derived.requireApproval, ...extras.requireApproval]),
      taskIds: [],
      createdAt: nowIso(),
      principalId: this.principalId,
    };
    this.store.saveEnvironment(environment);
    return environment;
  }

  /**
   * Human grant-review: Task-scoped Manifest from tools the human selected.
   * Unselected sketch rows become DENY leftovers. Not a standing ALLOW.
   */
  grantReviewed(input: {
    worker: string;
    tools: unknown[];
    proposalGoal?: string;
    sketchedTools?: Array<{ name: string; capability: string; reason?: string }>;
    sketchedToolNames: string[];
    sketchId?: string;
    sketchHash?: string;
  }): { environment: DeveloperEnvironmentRecord; task: StoredTask } {
    const selected = input.tools.map(parseToolDeclaration);
    if (selected.length === 0) {
      fail(400, "Send the tools you choose to grant. Passing only a proposal auto-grants nothing.");
    }
    const selectedNames = new Set(selected.map((tool) => tool.name));
    const leftoverDenials: GrantLeftoverDenial[] = (input.sketchedTools ?? [])
      .filter((tool) => !selectedNames.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        capability: tool.capability,
        reason: PRODUCT_LEFTOVER_DENY,
      }));
    const leftoverTools: RegisteredTool[] = leftoverDenials.map((row) => ({
      name: row.name,
      capability: row.capability,
      policy: "deny",
    }));
    const tools = [...selected, ...leftoverTools];
    const capabilitiesAdded = selected
      .filter((tool) => tool.policy !== "deny")
      .map((tool) => tool.capability);
    const capabilitiesRemoved = leftoverDenials.map((row) => row.capability);
    const environment = this.createEnvironment({ worker: input.worker, tools });
    const task = this.createTask({
      environmentId: environment.id,
      goal: input.proposalGoal ?? "Task-scoped Manifest after human grant.",
    });
    const fresh = this.requireEnvironment(environment.id, true);
    const grantReview: GrantReviewRecord = {
      at: nowIso(),
      auto: false,
      confirm: true,
      scope: "task",
      grantedBy: "human",
      grantor: this.principalId ?? "desk-session",
      worker: input.worker,
      workerId: task.brief.workerId,
      taskId: task.brief.id,
      environmentId: fresh.id,
      sketchId: input.sketchId,
      sketchHash: input.sketchHash,
      capabilitiesAdded,
      capabilitiesRemoved,
      selectedTools: selected,
      leftoverDenials,
      proposalGoal: input.proposalGoal,
      sketchedToolNames: [...input.sketchedToolNames],
      note: `${PRODUCT_SKETCH_REVIEW} Task-scoped. Not a standing ALLOW. Untouched sketch rows stay DENY-able. The API key did not grant.`,
      principalId: this.principalId,
    };
    fresh.grantReview = grantReview;
    this.store.saveEnvironment(fresh);
    appendGrantDecision(this.store.dataRoot(), { ...grantReview, environmentId: fresh.id });
    const audit = new AuditLog(this.store.auditPath(task.brief.id));
    audit.record({
      taskId: task.brief.id,
      actor: "user",
      action: "manifest.grant",
      details: {
        grantor: grantReview.grantor,
        grantedBy: "human",
        worker: input.worker,
        workerId: task.brief.workerId,
        environmentId: fresh.id,
        sketchId: input.sketchId,
        sketchHash: input.sketchHash,
        capabilitiesAdded,
        capabilitiesRemoved,
        leftoverDenials,
        selectedTools: selected.map((tool) => tool.name),
        scope: "task",
        auto: false,
      },
    });
    return { environment: fresh, task };
  }

  listGrantDecisions() {
    return readGrantDecisions(this.store.dataRoot()).filter((entry) => {
      if (!this.principalId) return true;
      return entry.principalId === this.principalId;
    });
  }

  registerTools(environmentId: string, toolsRaw: unknown): DeveloperEnvironmentRecord {
    const environment = this.requireEnvironment(environmentId, true);
    if (!Array.isArray(toolsRaw) || toolsRaw.length === 0) {
      fail(400, "Send a tools array.");
    }
    let tools = environment.tools;
    for (const item of toolsRaw) tools = mergeTool(tools, parseToolDeclaration(item));
    return this.writeCapabilities(environment, tools, {});
  }

  declareCapabilities(
    environmentId: string,
    lists: unknown,
  ): DeveloperEnvironmentRecord {
    const environment = this.requireEnvironment(environmentId, true);
    return this.writeCapabilities(environment, environment.tools, parseCapabilityLists(lists));
  }

  getEnvironment(environmentId: string): DeveloperEnvironmentRecord {
    return this.requireEnvironment(environmentId, false);
  }

  createTask(input: { environmentId?: unknown; goal?: unknown }): StoredTask {
    const environmentId = asString(input.environmentId);
    const goal = asString(input.goal);
    if (!environmentId) fail(400, "environmentId is required.");
    if (!goal) fail(400, "goal is required.");
    const environment = this.requireEnvironment(environmentId, true);
    if (environment.grantReview?.scope === "task" && environment.taskIds.length >= 1) {
      fail(
        409,
        "Grant is Task-scoped. Propose and grant again for a new Task. This is not a standing ALLOW across Tasks.",
      );
    }
    if (environment.tools.length === 0) {
      fail(400, "Register at least one tool before creating a task.");
    }
    const brief = bindBriefToWorker(
      this.store,
      newBrief(goal, [], {
        workerKind: "developer",
        environmentId: environment.id,
        registeredTools: environment.tools,
        developerGranted: environment.granted,
        developerDenied: environment.denied,
        developerRequireApproval: environment.requireApproval,
        createdByName: environment.worker,
        principalId: this.principalId ?? environment.principalId,
      }),
    );
    this.store.workspaceRoot(brief.id);
    const task: StoredTask = {
      brief,
      status: "queued",
      findings: [],
      artifacts: [],
      review: emptyReview(),
      modelProvider: environment.worker,
    };
    this.store.save(task);
    environment.taskIds = [...environment.taskIds, brief.id];
    this.store.saveEnvironment(environment);
    return task;
  }

  attachFile(
    taskId: string,
    input: { name?: unknown; content?: unknown; encoding?: unknown },
  ): { path: string; bytes: number } {
    const task = this.requireTask(taskId);
    if (task.status !== "queued") fail(409, "Files can only be attached before the task runs.");
    const environment = this.requireBoundEnvironment(task, false);
    if (environment.status === "destroyed") fail(409, "This WorkerEnvironment has been destroyed.");
    const name = safeFileName(asString(input.name));
    if (!name) fail(400, "File name is required.");
    const encoding = asString(input.encoding) ?? "utf8";
    const content = input.content;
    if (typeof content !== "string") fail(400, "content must be a string.");
    const bytes = encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf8");
    const relativePath = `sources/${name}`;
    const dir = join(this.store.workspaceRoot(task.brief.id), "sources");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), bytes);
    const existing = task.brief.sourceFiles.filter((file) => file.name !== name);
    task.brief.sourceFiles = [...existing, { name, relativePath }];
    this.store.save(task);
    return { path: relativePath, bytes: bytes.length };
  }

  async run(
    taskId: string,
    input: { requests?: unknown },
  ): Promise<DeveloperTaskView> {
    const task = this.requireTask(taskId);
    if (task.status !== "queued") fail(409, "This task has already been run.");
    const environment = this.requireBoundEnvironment(task, true);
    if (environment.tools.length === 0) fail(400, "Register tools before running.");
    if (!Array.isArray(input.requests) || input.requests.length === 0) {
      fail(400, "Send requests: [{ tool, args }]. You bring the agent loop.");
    }
    const requests: ActionRequest[] = sanitizeDeclaredRequests(
      input.requests.map((raw, index) => {
        if (!raw || typeof raw !== "object") fail(400, "Each request must be an object.");
        const record = raw as Record<string, unknown>;
        const tool = asString(record.tool);
        if (!tool) fail(400, `Request ${index} needs a tool name.`);
        const args =
          record.args && typeof record.args === "object" && !Array.isArray(record.args)
            ? (record.args as Record<string, unknown>)
            : {};
        return {
          id: id("req"),
          taskId: task.brief.id,
          tool,
          args,
          requestedBy: "agent",
          rationale: asString(record.rationale),
        };
      }),
      task.brief.id,
    );

    task.brief.registeredTools = environment.tools;
    task.brief.developerGranted = environment.granted;
    task.brief.developerDenied = environment.denied;
    task.brief.developerRequireApproval = environment.requireApproval;
    bindBriefToWorker(this.store, task.brief);
    this.store.save(task);

    const { task: ran } = await runDeveloperTask(task.brief, requests, { store: this.store });
    environment.latestEnvironment = ran.environment;
    this.store.saveEnvironment(environment);
    return this.view(ran, environment.worker);
  }

  status(taskId: string): DeveloperTaskView {
    const task = this.requireTask(taskId);
    const worker = this.store.getEnvironment(task.brief.environmentId ?? "")?.worker ?? task.modelProvider;
    return this.view(task, worker);
  }

  audit(taskId: string) {
    this.requireTask(taskId);
    return this.store.readAudit(taskId);
  }

  outputs(taskId: string) {
    const task = this.requireTask(taskId);
    const files = this.store.listArtifactFiles(taskId).map((file) => {
      const raw = this.store.readArtifact(taskId, file.relativePath);
      const text =
        raw && file.bytes <= 32_000 && !raw.includes(0) ? raw.toString("utf8") : undefined;
      return { ...file, text };
    });
    return { artifacts: task.artifacts, files };
  }

  destroyEnvironment(environmentId: string): DeveloperEnvironmentRecord {
    const environment = this.requireEnvironment(environmentId, false);
    if (environment.status === "destroyed") return environment;
    environment.status = "destroyed";
    environment.destroyedAt = nowIso();
    if (environment.latestEnvironment && environment.latestEnvironment.status !== "destroyed") {
      environment.latestEnvironment = {
        ...environment.latestEnvironment,
        status: "destroyed",
        destroyedAt: environment.destroyedAt,
      };
    }
    for (const taskId of environment.taskIds) {
      const task = this.store.get(taskId);
      if (!task?.identity || task.identity.status === "expired") continue;
      task.identity = expireIdentity(task.identity);
      const audit = new AuditLog(this.store.auditPath(taskId));
      audit.record({
        taskId,
        actor: "control-plane",
        action: "identity.expired",
        details: {
          identityId: task.identity.id,
          expiresAt: task.identity.expiresAt,
          via: "environment.destroy",
        },
      });
      this.store.save(task);
    }
    this.store.saveEnvironment(environment);
    return environment;
  }

  private writeCapabilities(
    environment: DeveloperEnvironmentRecord,
    tools: RegisteredTool[],
    extras: { granted: string[]; denied: string[]; requireApproval: string[] },
  ): DeveloperEnvironmentRecord {
    const derived = baseCapabilities(tools);
    environment.tools = tools;
    environment.granted = uniqueCapabilities([...derived.granted, ...extras.granted]);
    environment.denied = uniqueCapabilities([...derived.denied, ...extras.denied]);
    environment.requireApproval = uniqueCapabilities([
      ...derived.requireApproval,
      ...extras.requireApproval,
    ]);
    this.store.saveEnvironment(environment);
    return environment;
  }

  private requireEnvironment(id: string, ready: boolean): DeveloperEnvironmentRecord {
    const environment = this.store.getEnvironment(id);
    if (!environment || !this.owns(environment.principalId)) fail(404, "WorkerEnvironment not found.");
    if (ready && environment.status !== "ready") {
      fail(409, "This WorkerEnvironment has been destroyed.");
    }
    return environment;
  }

  private requireTask(taskId: string): StoredTask {
    const task = this.store.get(taskId);
    if (!task) fail(404, "Task not found.");
    if (task.brief.workerKind !== "developer") {
      fail(404, "Task not found.");
    }
    if (!this.owns(task.brief.principalId)) fail(404, "Task not found.");
    return task;
  }

  /** Keyed /api/v1 callers only see their own resources. Unscoped in-process tests see all. */
  private owns(resourcePrincipal?: string): boolean {
    if (!this.principalId) return true;
    return resourcePrincipal === this.principalId;
  }

  private requireBoundEnvironment(task: StoredTask, ready: boolean): DeveloperEnvironmentRecord {
    const environmentId = task.brief.environmentId;
    if (!environmentId) fail(400, "Task is not bound to a WorkerEnvironment.");
    return this.requireEnvironment(environmentId, ready);
  }

  private view(task: StoredTask, worker: string): DeveloperTaskView {
    return {
      id: task.brief.id,
      goal: task.brief.goal,
      status: task.status,
      worker,
      environmentId: task.brief.environmentId ?? "",
      identity: task.identity,
      environment: task.environment,
      summary: task.summary,
      findings: task.findings,
      artifacts: task.artifacts,
      governance: task.governance,
      error: task.error,
    };
  }
}

function parseCapabilityLists(raw: unknown): {
  granted: string[];
  denied: string[];
  requireApproval: string[];
} {
  if (raw == null) return { granted: [], denied: [], requireApproval: [] };
  if (typeof raw !== "object") fail(400, "capabilities must be an object.");
  const record = raw as Record<string, unknown>;
  return {
    granted: stringList(record.granted),
    denied: stringList(record.denied),
    requireApproval: stringList(record.requireApproval ?? record.require_approval),
  };
}

function stringList(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(400, "Capability lists must be arrays of strings.");
  return value.map((item) => {
    const text = asString(item);
    if (!text) fail(400, "Capability lists must be arrays of strings.");
    return text;
  });
}

function safeFileName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const base = basename(name.replaceAll("\\", "/"));
  if (!base || base === "." || base === ".." || base.includes("..")) return undefined;
  return base;
}
