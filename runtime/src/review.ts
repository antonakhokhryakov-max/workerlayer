import {
  FIX_TARGETS,
  nowIso,
  type ArtifactKind,
  type ArtifactRecord,
  type FixTarget,
  type ReviewAction,
} from "@aether/contracts";
import { identityIsUsable, summarizeGovernance } from "@aether/control-plane";
import { IsolatedPlanner } from "./planner-bridge";
import { reopenControlPlane } from "./kernel";
import { emptyReview, type StoredTask, type TaskStore } from "./store";

export function suggestedFixTarget(task: StoredTask): FixTarget {
  const codes = (task.quality?.issues ?? []).map((issue) => issue.code);
  if (codes.some((code) => code.includes("number") || code.includes("companies") || code.startsWith("consistency"))) {
    return "consistency";
  }
  if (codes.some((code) => code.includes("uncertain") || code.includes("conflict"))) {
    return "uncertainty";
  }
  if (codes.some((code) => code.includes("slide") || code.includes("empty"))) {
    return "slides";
  }
  if (codes.some((code) => code.includes("source") || code.includes("citation"))) {
    return "citations";
  }
  return "consistency";
}

async function reviewPlanner(kind: string): Promise<IsolatedPlanner> {
  return IsolatedPlanner.start(kind, {
    modelKind: process.env.OPENAI_API_KEY ? undefined : "deterministic",
  });
}

export async function reviewTask(
  store: TaskStore,
  taskId: string,
  action: ReviewAction,
  target?: FixTarget,
): Promise<StoredTask> {
  const task = store.get(taskId);
  if (!task) throw new Error("Task not found.");
  if (task.status !== "awaiting_review" && action !== "request_fix") {
    if (task.status !== "completed") {
      throw new Error("This assignment is not waiting for review.");
    }
  }
  if (action === "request_fix" && task.status !== "awaiting_review" && task.status !== "completed") {
    throw new Error("This assignment is not waiting for review.");
  }

  const review = task.review ?? emptyReview();
  const { plane, workstation, environment } = reopenControlPlane(task, store);
  let isolated: IsolatedPlanner | undefined;

  try {
    if (action === "accept" || action === "reject") {
      if (!identityIsUsable(plane.identity) && plane.identity.status !== "expired") {
        plane.expireIdentity();
      } else if (plane.identity.status === "active") {
        plane.expireIdentity();
      }
      review.status = action === "accept" ? "accepted" : "rejected";
      if (action === "reject") review.interventions += 1;
      review.history.push({ at: nowIso(), action });
      task.status = action === "accept" ? "accepted" : "rejected";
      task.review = review;
      task.identity = plane.identity;
      plane.audit.record({
        taskId,
        actor: "user",
        action: action === "accept" ? "review.accepted" : "review.rejected",
        details: { interventions: review.interventions, fixRequests: review.fixRequests },
      });
      if (task.evaluation) {
        task.evaluation.userInterventions = review.interventions;
      }
      store.save(task);
      store.saveApprovals(taskId, plane.approvals.list(taskId));
      return task;
    }

    const chosen = target ?? suggestedFixTarget(task);
    const label = FIX_TARGETS.find((item) => item.id === chosen)?.label ?? chosen;
    review.fixRequests += 1;
    review.interventions += 1;
    review.lastTarget = chosen;
    review.status = "pending";
    review.history.push({ at: nowIso(), action: "request_fix", target: chosen, label });
    task.review = review;
    task.status = "running";
    store.save(task);

    if (!identityIsUsable(plane.identity)) {
      plane.reissueIdentity();
    }
    plane.audit.record({
      taskId,
      actor: "user",
      action: "review.fix_requested",
      details: { target: chosen, label, interventions: review.interventions },
    });

    const kind = task.brief.workerKind ?? "knowledge";
    const planner = await reviewPlanner(kind);
    isolated = planner;
    await planner.hydrate(task);
    await planner.beginFix(chosen);
    planner.applyToTask(task);
    plane.audit.record({
      taskId,
      actor: "control-plane",
      action: "planner.spawned",
      details: {
        pid: isolated.pid,
        hostPid: process.pid,
        kind,
        isolated: true,
        via: "human_fix",
      },
    });

    for (let step = 0; step < 10; step += 1) {
      const intent = await planner.nextIntent(task.brief);
      if (intent.type === "finish") {
        task.summary = intent.summary;
        break;
      }
      plane.audit.record({
        taskId,
        actor: "agent",
        action: "action.requested",
        tool: intent.request.tool,
        details: {
          requestId: intent.request.id,
          args: intent.request.args,
          rationale: intent.request.rationale,
          via: "human_fix",
        },
      });
      const handled = await plane.dispatch(intent.request, workstation);
      await Promise.resolve(planner.observe(handled));
      planner.applyToTask(task);
      const data = handled.result.data ?? {};
      if (handled.result.ok && typeof data.path === "string" && typeof data.kind === "string") {
        const kind = data.kind as ArtifactKind;
        const artifact: ArtifactRecord = {
          name: data.path.split("/").pop() ?? data.path,
          relativePath: data.path,
          kind,
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
            ? { ...item, validated: Boolean(data.valid) }
            : item,
        );
      }
    }

    planner.applyToTask(task);
    task.status = "awaiting_review";
    task.identity = plane.identity;
    task.governance = summarizeGovernance(plane.audit.list(), plane.identity);
    if (task.evaluation) {
      task.evaluation.userInterventions = review.interventions;
      task.evaluation.deliveryScore = task.quality?.deliveryScore;
      task.evaluation.sendableAfterOneReview = task.quality?.sendableAfterOneReview;
    }
    plane.audit.record({
      taskId,
      actor: "control-plane",
      action: "review.fix_finished",
      details: {
        target: chosen,
        deliveryScore: task.quality?.deliveryScore,
        sendable: task.quality?.sendableAfterOneReview,
      },
    });
    environment.syncOut();
    store.save(task);
    store.saveApprovals(taskId, plane.approvals.list(taskId));
    return store.get(taskId) ?? task;
  } finally {
    await isolated?.stop();
    environment.destroy();
    task.isolation = task.isolation
      ? { ...task.isolation, status: "destroyed" }
      : environment.record();
    if (task.environment) {
      task.environment = { ...task.environment, status: "destroyed" };
    }
    store.save(task);
  }
}
