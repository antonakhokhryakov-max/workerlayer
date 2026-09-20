import { createModelProvider } from "@aether/agent";
import type { ModelProvider } from "@aether/agent";
import {
  AuditLog,
  ControlPlane,
  compileDeclaredEnvironment,
  declareWorkerEnvironment,
  summarizeGovernance,
  userPrincipal,
} from "@aether/control-plane";
import "./builtins";
import { requireWorkerRegistration, type VerticalPlanner } from "./registry";
import type {
  ActionRequest,
  ArtifactKind,
  ArtifactRecord,
  EvaluationReport,
  HandledAction,
  TaskBrief,
  TaskCapabilities,
  TaskStatus,
} from "@aether/contracts";
import { id, nowIso } from "@aether/contracts";
import { evaluateTask, loadGroundTruth } from "../../eval/evaluate";
import {
  composeWorkerEnvironment,
  selectComputeProvider,
  Workstation,
  type ExecutionProvider,
  type TaskEnvironment,
  type WorkerEnvironment,
} from "@aether/workstation";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { StoredTask } from "./store";
import { emptyReview, TaskStore } from "./store";
import { IsolatedPlanner, plannerIsolationEnabled } from "./planner-bridge";
import { sanitizeDeclaredRequests, sanitizePlannerIntent } from "./sanitize-intent";
import { bindBriefToWorker, capabilitiesFromBrief, capabilitiesFromManifest } from "./workers";

export interface RunOptions {
  store?: TaskStore;
  model?: ModelProvider;
  maxSteps?: number;
  groundTruthPath?: string;
  executionProvider?: ExecutionProvider;
  /**
   * Default true. Set false only when calling the kernel directly to debug.
   * Desk, CLI, AetherPlatform, and /api/v1 cannot turn this off.
   */
  isolatePlanner?: boolean;
}

type AssignmentAgent = VerticalPlanner;

export interface RunResult {
  task: StoredTask;
  auditCount: number;
}

function persist(
  store: TaskStore,
  plane: ControlPlane,
  task: StoredTask,
  environment?: TaskEnvironment,
): void {
  environment?.syncOut();
  store.save(task);
  store.saveApprovals(task.brief.id, plane.approvals.list(task.brief.id));
}

function computeProviderFor(
  store: TaskStore,
  taskId: string,
  override?: ExecutionProvider,
): ExecutionProvider {
  if (override) return override;
  const existing = store.get(taskId);
  const sticky = existing?.isolation?.provider ?? existing?.environment?.computeProvider;
  return selectComputeProvider({ sticky });
}

function attachEnvironment(
  store: TaskStore,
  taskId: string,
  plane: ControlPlane,
  provider: ExecutionProvider,
): { isolation: TaskEnvironment; workstation: Workstation; workerEnv: WorkerEnvironment } {
  const durableRoot = store.workspaceRoot(taskId);
  const isolation = provider.create({ taskId, durableRoot });
  const spec = compileDeclaredEnvironment(
    declareWorkerEnvironment({
      assignmentId: taskId,
      workerId: plane.task.workerId,
      capabilityManifestId: plane.task.capabilityManifestId,
      granted: plane.capabilities.granted,
      denied: plane.capabilities.denied,
      approvedDestinations: plane.task.approvedDestinations,
    }),
  );
  const workerEnv = composeWorkerEnvironment(spec, isolation);
  const workstation = new Workstation(
    isolation.workspace(),
    plane.grantVerifier(),
    isolation,
    workerEnv.adapters,
  );
  return { isolation, workstation, workerEnv };
}

function recordEnvironmentProbes(
  environment: TaskEnvironment,
  taskId: string,
  plane: ControlPlane,
): void {
  const bait = join(
    resolve(environment.durableRoot, "..", ".."),
    "isolation-bait",
    "cross-task-secret.txt",
  );
  mkdirSync(dirname(bait), { recursive: true });
  writeFileSync(bait, "name,pay\nshould-not-be-readable\n");
  const probes = [
    environment.probeInside("/etc/passwd"),
    environment.probeInside(bait),
  ];
  for (const probe of probes) {
    plane.audit.record({
      taskId,
      actor: "workstation",
      action: "environment.probe",
      decision: probe.readable ? "allow" : "deny",
      details: {
        path: probe.path,
        readable: probe.readable,
        error: probe.error,
        provider: environment.kind,
      },
    });
  }
}

export function capabilitiesForAssignment(brief: TaskBrief, workspaceRoot: string): TaskCapabilities {
  return capabilitiesFromBrief(brief, workspaceRoot);
}

/**
 * Look up the registered planner for this WorkerKind and run it.
 * No switch on chief_of_staff / claims / knowledge.
 */
export async function runRegisteredTask(
  brief: TaskBrief,
  options: RunOptions = {},
): Promise<RunResult> {
  const kind = brief.workerKind ?? "knowledge";
  const registration = requireWorkerRegistration(kind);
  return runAssignedTask(brief, {
    ...options,
    modelName: options.model?.name ?? registration.modelName ?? kind,
  });
}

export async function runClaimsTask(
  brief: TaskBrief,
  options: RunOptions = {},
): Promise<RunResult> {
  return runRegisteredTask({ ...brief, workerKind: brief.workerKind ?? "claims" }, options);
}

/**
 * Trusted kernel. This is the only place the three layers meet.
 * Isolated planner proposes over IPC → control plane decides → workstation executes.
 * Which planner runs is a registry lookup, not a switch.
 */
export async function runKnowledgeTask(
  brief: TaskBrief,
  options: RunOptions = {},
): Promise<RunResult> {
  const model = options.model ?? createModelProvider();
  return runAssignedTask(brief, {
    ...options,
    model,
    modelName: model.name,
  });
}

export async function runChiefOfStaffTask(
  brief: TaskBrief,
  options: RunOptions = {},
): Promise<RunResult> {
  return runRegisteredTask({ ...brief, workerKind: brief.workerKind ?? "chief_of_staff" }, options);
}

/**
 * Developer-declared requests. The caller already chose the tools.
 * No planner process. No in-process agent. Control plane decides each intent.
 */
export async function runDeveloperTask(
  brief: TaskBrief,
  requests: ActionRequest[],
  options: RunOptions = {},
): Promise<RunResult> {
  const requestList = sanitizeDeclaredRequests(requests, brief.id);
  return runAssignedTask(brief, {
    ...options,
    modelName: brief.createdBy.name || "developer",
    requestList,
    maxSteps: Math.max(requestList.length + 2, 4),
  });
}

async function runAssignedTask(
  brief: TaskBrief,
  options: RunOptions & { modelName?: string; requestList?: ActionRequest[] },
): Promise<RunResult> {
  const store = options.store ?? new TaskStore();
  bindBriefToWorker(store, brief);
  store.sealOriginals(brief.id);
  const workspaceRoot = store.workspaceRoot(brief.id);
  const started = Date.now();
  const capabilities = capabilitiesFromManifest(store, brief, workspaceRoot);
  const audit = new AuditLog(store.auditPath(brief.id));
  const plane = new ControlPlane(audit, capabilities, brief);
  const provider = computeProviderFor(store, brief.id, options.executionProvider);
  const { isolation: environment, workstation, workerEnv } = attachEnvironment(
    store,
    brief.id,
    plane,
    provider,
  );
  const kind = brief.workerKind ?? "knowledge";
  const registration = requireWorkerRegistration(kind);
  const modelName = options.modelName ?? options.model?.name ?? registration.modelName ?? kind;
  const requestList = options.requestList;
  let isolated: IsolatedPlanner | undefined;
  let worker: AssignmentAgent | undefined;
  let task: StoredTask | undefined;
  const declaredHandled: HandledAction[] = [];
  let declaredIndex = 0;
  try {
    if (!requestList) {
      if (plannerIsolationEnabled(options)) {
        isolated = await IsolatedPlanner.start(kind, {
          modelKind: options.model?.kind === "deterministic" ? "deterministic" : undefined,
        });
        worker = isolated;
      } else {
        worker = registration.createPlanner({ model: options.model });
      }
      if (!worker) {
        throw new Error("Planner was not created.");
      }
    }

    task = {
      brief,
      status: "running",
      findings: [],
      artifacts: [],
      identity: plane.identity,
      isolation: environment.record(),
      environment: workerEnv.record(),
      review: emptyReview(),
      modelProvider: modelName,
    };
    if (requestList) {
      task.plan = {
        summary: brief.goal,
        steps: requestList.map((request, step) => ({
          id: `req-${step}`,
          title: request.tool,
          detail: request.rationale ?? `Request ${request.tool}.`,
          status: "pending" as const,
        })),
      };
    } else {
      task.plan = await Promise.resolve(worker!.plan(brief));
      isolated?.applyToTask(task);
    }

    audit.record({
      taskId: brief.id,
      actor: "user",
      action: "task.submitted",
      details: { goal: brief.goal, files: brief.sourceFiles },
    });
    audit.record({
      taskId: brief.id,
      actor: "control-plane",
      action: "worker.bound",
      details: {
        workerId: brief.workerId,
        capabilityManifestId: brief.capabilityManifestId,
        workerKind: brief.workerKind,
      },
    });
    audit.record({
      taskId: brief.id,
      actor: "control-plane",
      action: "identity.issued",
      details: {
        identityId: plane.identity.id,
        granted: plane.identity.granted,
        denied: plane.identity.denied,
        requireApproval: plane.identity.requireApproval,
        expiresAt: plane.identity.expiresAt,
      },
    });
    audit.record({
      taskId: brief.id,
      actor: "agent",
      action: "plan.created",
      details: { summary: task.plan.summary, steps: task.plan.steps.map((s) => s.title) },
    });
    if (isolated) {
      audit.record({
        taskId: brief.id,
        actor: "control-plane",
        action: "planner.spawned",
        details: {
          pid: isolated.pid,
          hostPid: process.pid,
          kind,
          isolated: true,
        },
      });
    }
    if (requestList) {
      audit.record({
        taskId: brief.id,
        actor: "control-plane",
        action: "developer.requests",
        details: {
          count: requestList.length,
          planner: false,
          isolated: false,
          via: "declared_requests",
        },
      });
    }
    audit.record({
      taskId: brief.id,
      actor: "workstation",
      action: "environment.created",
      details: {
        environmentId: environment.id,
        provider: environment.kind,
        stickyPerTask: true,
        durableRoot: workspaceRoot,
        workerId: brief.workerId,
        capabilityManifestId: brief.capabilityManifestId,
        substrates: workerEnv.substrates,
        compiledFrom: workerEnv.spec.compiledFrom,
      },
    });
    recordEnvironmentProbes(environment, brief.id, plane);
    task.isolation = environment.record();
    task.environment = workerEnv.record();
    persist(store, plane, task, environment);

    const maxSteps = options.maxSteps ?? capabilities.maxSteps;
    let pendingApproval = false;
    let finishSummary: string | undefined;

    for (let step = 0; step < maxSteps; step += 1) {
      let intent;
      if (requestList) {
        if (declaredIndex >= requestList.length) {
          const denied = declaredHandled.filter((item) => item.decision.decision === "deny").length;
          const allowed = declaredHandled.filter((item) => item.result.ok).length;
          finishSummary = `Declared requests finished: ${allowed} allowed, ${denied} denied.`;
          break;
        }
        const raw = requestList[declaredIndex];
        declaredIndex += 1;
        intent = sanitizePlannerIntent({
          type: "request",
          request: { ...raw, taskId: brief.id },
        });
      } else {
        intent = await worker!.nextIntent(brief);
      }
      if (intent.type === "finish") {
        finishSummary = intent.summary;
        break;
      }

      audit.record({
        taskId: brief.id,
        actor: "agent",
        action: "action.requested",
        tool: intent.request.tool,
        details: {
          requestId: intent.request.id,
          args: intent.request.args,
          rationale: intent.request.rationale,
        },
      });

      const handled = await plane.dispatch(intent.request, workstation);
      if (requestList) {
        declaredHandled.push(handled);
        task.findings = declaredHandled.map((item) => ({
          category: item.request.tool,
          finding:
            item.decision.decision === "allow" && item.result.ok
              ? `${item.request.tool} allowed`
              : item.decision.reason,
          evidence: item.decision.reason,
          source: item.request.tool,
          confidence: "high" as const,
        }));
      } else {
        await Promise.resolve(worker!.observe(handled));
        worker!.applyToTask(task);
      }
      task.identity = plane.identity;
      task.governance = summarizeGovernance(audit.list(), plane.identity);

      const data = handled.result.data ?? {};
      if (handled.result.ok && typeof data.path === "string" && typeof data.kind === "string") {
        const artifactKind = data.kind as ArtifactKind;
        const artifact: ArtifactRecord = {
          name: data.path.split("/").pop() ?? data.path,
          relativePath: data.path,
          kind: artifactKind,
          title: typeof data.title === "string" ? data.title : undefined,
          createdAt: nowIso(),
          validated: false,
        };
        task.artifacts = [
          ...task.artifacts.filter((item) => item.relativePath !== artifact.relativePath),
          artifact,
        ];
      }
      if (handled.request.tool === "artifact.validate" && typeof data.path === "string") {
        task.artifacts = task.artifacts.map((item) =>
          item.relativePath === data.path
            ? {
                ...item,
                validated: Boolean(data.valid),
                validationNotes: Array.isArray(data.notes)
                  ? data.notes.map((note) => String(note))
                  : item.validationNotes,
              }
            : item,
        );
      }

      if (handled.result.status === "pending_approval") {
        pendingApproval = true;
        finishSummary = handled.result.error ?? "A sensitive action needs approval.";
        break;
      }

      if (handled.decision.decision === "deny" && !handled.result.ok) {
        persist(store, plane, task, environment);
        continue;
      }

      persist(store, plane, task, environment);
    }

    const delivered = requestList
      ? declaredHandled.length >= requestList.length || Boolean(finishSummary)
      : worker!.isDelivered() || Boolean(finishSummary);
    const status: TaskStatus = pendingApproval
      ? "blocked_on_approval"
      : delivered
        ? "awaiting_review"
        : "failed";

    task.status = status;
    task.summary = finishSummary ?? task.summary;
    task.error = status === "failed" ? "Agent stopped before a validated artifact." : undefined;
    if (status === "failed") plane.expireIdentity();
    if (status === "awaiting_review") {
      task.review = task.review ?? emptyReview();
      task.review.status = "pending";
    }
    task.identity = plane.identity;
    task.governance = summarizeGovernance(audit.list(), plane.identity);
    audit.record({
      taskId: brief.id,
      actor: "control-plane",
      action: "task.finished",
      details: { status, summary: task.summary, identityId: plane.identity.id },
    });
    if (options.groundTruthPath) {
      const report: EvaluationReport = evaluateTask(
        task,
        store,
        loadGroundTruth(options.groundTruthPath),
        Date.now() - started,
      );
      task.evaluation = report;
      store.save(task);
    }
    persist(store, plane, task, environment);
    return { task, auditCount: audit.list().length };
  } catch (error) {
    if (task) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : String(error);
      audit.record({
        taskId: brief.id,
        actor: "control-plane",
        action: "task.failed",
        details: { error: task.error },
      });
      persist(store, plane, task, environment);
    }
    throw error;
  } finally {
    await isolated?.stop();
    const tornDown = environment.destroy();
    audit.record({
      taskId: brief.id,
      actor: "workstation",
      action: "environment.destroyed",
      details: {
        environmentId: environment.id,
        provider: environment.kind,
        outputsPreserved: tornDown.outputsPreserved,
        rootGone: tornDown.rootGone,
      },
    });
    if (task) {
      task.isolation = environment.record();
      task.environment = workerEnv.markDestroyed();
      persist(store, plane, task);
    }
  }
}

export function reopenControlPlane(
  task: StoredTask,
  store: TaskStore,
  provider: ExecutionProvider = computeProviderFor(store, task.brief.id),
): {
  plane: ControlPlane;
  workstation: Workstation;
  environment: TaskEnvironment;
  workerEnv: WorkerEnvironment;
} {
  bindBriefToWorker(store, task.brief);
  const workspaceRoot = store.workspaceRoot(task.brief.id);
  const capabilities = capabilitiesFromManifest(store, task.brief, workspaceRoot);
  const audit = new AuditLog(store.auditPath(task.brief.id));
  const plane = new ControlPlane(
    audit,
    capabilities,
    task.brief,
    undefined,
    undefined,
    task.identity,
  );
  plane.approvals.hydrate(store.loadApprovals(task.brief.id));
  const { isolation: environment, workstation, workerEnv } = attachEnvironment(
    store,
    task.brief.id,
    plane,
    provider,
  );
  return { plane, workstation, environment, workerEnv };
}

export function newBrief(
  goal: string,
  files: Array<{ name: string; relativePath: string }>,
  extras?: {
    approvedDestinations?: string[];
    workerId?: string;
    capabilityManifestId?: string;
    workerKind?: TaskBrief["workerKind"];
    environmentId?: string;
    registeredTools?: TaskBrief["registeredTools"];
    developerGranted?: string[];
    developerDenied?: string[];
    developerRequireApproval?: string[];
    createdByName?: string;
    principalId?: string;
    taskId?: string;
  },
): TaskBrief {
  return {
    id: extras?.taskId ?? id("tsk"),
    goal,
    createdAt: nowIso(),
    createdBy: extras?.principalId
      ? { type: "user", id: extras.principalId, name: extras.createdByName ?? "developer" }
      : extras?.createdByName
        ? { type: "user", id: "developer", name: extras.createdByName }
        : userPrincipal(),
    sourceFiles: files,
    approvedDestinations: extras?.approvedDestinations,
    workerId: extras?.workerId,
    capabilityManifestId: extras?.capabilityManifestId,
    workerKind: extras?.workerKind,
    environmentId: extras?.environmentId,
    principalId: extras?.principalId,
    registeredTools: extras?.registeredTools,
    developerGranted: extras?.developerGranted,
    developerDenied: extras?.developerDenied,
    developerRequireApproval: extras?.developerRequireApproval,
  };
}
