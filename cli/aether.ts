import { basename } from "node:path";
import {
  AetherPlatform,
  TaskStore,
  EFFORT_BOARD_NOTE,
  formatEffortLine,
  reviewTask,
  runBenchmarkTask,
  runApprovedTask,
  resolveTaskApproval,
  runCedarlineClaimsTask,
  runDiligenceTask,
  runSampleTask,
  runStaffWeeklyTask,
  runStaffInvestorTask,
  loadVerticals,
  requireWorkerRegistration,
  summarizeEffort,
} from "@aether/runtime";
import { PRODUCT_ALPHA_LABEL, PRODUCT_MOTTO, PRODUCT_NAME, PRODUCT_TAGLINE, type FixTarget } from "@aether/contracts";

function usage(): never {
  console.log(`${PRODUCT_NAME} — ${PRODUCT_TAGLINE}
${PRODUCT_MOTTO}
${PRODUCT_ALPHA_LABEL}

Usage:
  pnpm aether echo          # default second worker (external package)
  pnpm aether sample
  pnpm aether diligence
  pnpm aether approved
  pnpm aether claims
  pnpm aether staff
  pnpm aether investor
  pnpm aether benchmark
  pnpm aether run --goal "..." --file path [--file path]
  pnpm aether show <taskId>
  pnpm aether approve <taskId> <approvalId>
  pnpm aether deny <taskId> <approvalId>
  pnpm aether accept <taskId>
  pnpm aether reject <taskId>
  pnpm aether fix <taskId> [--target consistency|uncertainty|citations|slides]
  pnpm aether effort
`);
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const store = new TaskStore();
  await loadVerticals();

  if (command === "echo") {
    const registration = requireWorkerRegistration("echo_clerk");
    const plat = new AetherPlatform(store);
    const worker = plat.ensureWorker("echo_clerk");
    const queued = plat.createTask(worker.id, {
      goal: registration.defaultGoal ?? "Echo the attached line.",
      fileContents: [{ name: "note.md", bytes: "ping" }],
      registeredTools: registration.defaultTools,
    });
    await plat.runTask(queued.brief.id);
    printTask(store, queued.brief.id);
    return;
  }

  if (command === "sample") {
    const { task } = await runSampleTask(store);
    printTask(store, task.brief.id);
    return;
  }

  if (command === "diligence") {
    const { task } = await runDiligenceTask(store);
    printTask(store, task.brief.id);
    return;
  }

  if (command === "benchmark") {
    const { task } = await runBenchmarkTask(store);
    printTask(store, task.brief.id);
    return;
  }

  if (command === "approved") {
    const { task } = await runApprovedTask(store);
    printTask(store, task.brief.id);
    return;
  }

  if (command === "claims") {
    const { task } = await runCedarlineClaimsTask(store);
    printTask(store, task.brief.id);
    return;
  }

  if (command === "staff") {
    const { task } = await runStaffWeeklyTask(store);
    printTask(store, task.brief.id);
    return;
  }

  if (command === "investor") {
    const { task } = await runStaffInvestorTask(store);
    printTask(store, task.brief.id);
    return;
  }

  if (command === "run") {
    const goal = flag(argv, "--goal");
    const files = flags(argv, "--file");
    if (!goal || files.length === 0) usage();
    const plat = new AetherPlatform(store);
    const worker = plat.ensureWorker("knowledge");
    const queued = plat.createTask(worker.id, {
      goal,
      files: files.map((file) => ({ name: basename(file), absolutePath: file })),
    });
    await plat.runTask(queued.brief.id);
    printTask(store, queued.brief.id);
    return;
  }

  if (command === "effort") {
    const rows = summarizeEffort(store.list());
    if (rows.length === 0) {
      console.log("No tasks yet.");
      return;
    }
    console.log("\nHuman effort by pack");
    console.log(EFFORT_BOARD_NOTE);
    for (const row of rows) {
      const score =
        typeof row.averageDeliveryScore === "number"
          ? `${Math.round(row.averageDeliveryScore * 100)} / 100`
          : "—";
      console.log(`${row.label}`);
      console.log(
        `  counted=${row.tasks}  omitted=${row.omitted}  delivery=${score}  interventions=${row.averageInterventions}`,
      );
      console.log(
        `  accepted 0-fix=${row.acceptedZeroFix}  accepted after fix=${row.acceptedWithFixes}  rejected=${row.rejected}  awaiting=${row.awaiting}`,
      );
      if (row.latestLabel) console.log(`  latest: ${row.latestLabel}`);
    }
    return;
  }

  if (command === "show") {
    const taskId = argv[1];
    if (!taskId) usage();
    printTask(store, taskId);
    return;
  }

  if (command === "accept" || command === "reject") {
    const taskId = argv[1];
    if (!taskId) usage();
    await reviewTask(store, taskId, command === "accept" ? "accept" : "reject");
    printTask(store, taskId);
    return;
  }

  if (command === "fix") {
    const taskId = argv[1];
    if (!taskId) usage();
    const target = flag(argv, "--target") as FixTarget | undefined;
    await reviewTask(store, taskId, "request_fix", target);
    printTask(store, taskId);
    return;
  }

  if (command === "approve" || command === "deny") {
    const taskId = argv[1];
    const approvalId = argv[2];
    if (!taskId || !approvalId) usage();
    await resolveTaskApproval(
      store,
      taskId,
      approvalId,
      command === "approve" ? "approved" : "denied",
    );
    printTask(store, taskId);
    return;
  }

  usage();
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function flags(argv: string[], name: string): string[] {
  const values: string[] = [];
  argv.forEach((arg, index) => {
    if (arg === name && argv[index + 1]) values.push(argv[index + 1]);
  });
  return values;
}

function printTask(store: TaskStore, taskId: string): void {
  const task = store.get(taskId);
  if (!task) throw new Error(`Unknown task ${taskId}`);
  const audit = store.readAudit(taskId);
  const approvals = store.loadApprovals(taskId);
  console.log(`\nTask ${task.brief.id}  [${task.status}]`);
  console.log(PRODUCT_ALPHA_LABEL);
  console.log(`Goal: ${task.brief.goal}`);
  if (task.brief.workerId) {
    console.log(
      `Hierarchy: Worker ${task.brief.workerId} → Task ${task.brief.id} → Manifest ${task.brief.capabilityManifestId ?? "—"} → Environment ${task.environment?.id ?? "pending"}`,
    );
  }
  if (task.company) console.log(`Subject: ${task.company}`);
  if (task.summary) console.log(`Summary: ${task.summary}`);
  console.log(`Plan: ${task.plan?.steps.map((step) => `${step.status}:${step.title}`).join(" | ")}`);
  console.log(`Findings: ${task.findings.length}`);
  if (task.companies?.length) console.log(`Companies: ${task.companies.length}`);
  if (task.citations?.length) console.log(`Citations: ${task.citations.length}`);
  if (task.uncertainties?.length) console.log(`Uncertainty flags: ${task.uncertainties.length}`);
  if (task.identity) {
    console.log(
      `Worker: ${task.identity.id}  [${task.identity.status}]  granted=${task.identity.granted.length}`,
    );
  }
  if (task.environment) {
    console.log(
      `WorkerEnvironment: ${task.environment.id}  [${task.environment.status}]  substrates=${task.environment.substrates.join(",")}  compute=${task.environment.computeProvider}  compiled=${task.environment.spec.compiledFrom}`,
    );
  }
  console.log(`Effort: ${formatEffortLine(task)}`);
  if (task.review) {
    console.log(
      `Review: ${task.review.status}  interventions=${task.review.interventions}  fixes=${task.review.fixRequests}`,
    );
  }
  if (task.governance) {
    console.log(
      `Governance: allowed=${task.governance.authorizedActions} denied=${task.governance.deniedActions} approvals=${task.governance.approvalRequests} cross-task=${task.governance.crossTaskAccessAttempts}`,
    );
  }
  if (task.evaluation) {
    console.log(
      `Evaluation: success=${task.evaluation.taskSuccess} reviewCycles=${task.evaluation.selfReviewCycles} recall=${task.evaluation.factualAccuracy} citations=${task.evaluation.citationCoverage}`,
    );
    for (const note of task.evaluation.notes) console.log(`  note: ${note}`);
  }
  for (const artifact of task.artifacts) {
    console.log(
      `Artifact: ${artifact.kind} ${artifact.relativePath}${artifact.validated ? " (validated)" : ""}`,
    );
  }
  if (approvals.length) {
    console.log("Approvals:");
    for (const ticket of approvals) {
      console.log(`  ${ticket.id}  ${ticket.status}  ${ticket.reason}`);
    }
  }
  console.log(`Audit events: ${audit.length}`);
  for (const event of audit) {
    console.log(
      `  ${event.timestamp}  ${event.actor}  ${event.action}${event.decision ? ` → ${event.decision}` : ""}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
