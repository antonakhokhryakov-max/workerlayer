# Instinct for X — startup chief of staff

**Alpha — not for sensitive production workloads.**

North Dock’s chief of staff is a vertical on WorkerLayer. It is not a second platform.

## What this vertical owns

- Domain logic: weekly priorities, meeting prep, investor updates, decision log, open questions
- Agent behavior in `agents/src/chief-of-staff.ts`
- Registered tools (`staff.read`, `staff.priorities`, …) declared per Task
- Fixtures in `fixtures/north-dock-staff/`
- Two desk buttons and `pnpm aether staff` / `pnpm aether investor`

## What it does not own

Identity, policy, isolation, audit, lifecycle, WorkerEnvironment, ComputeProvider. Those stay in WorkerLayer.

## Persistent Worker

`wkr_chief_of_staff` survives across Tasks.

| Task | CapabilityManifest | Allowed | Denied on this Task |
| --- | --- | --- | --- |
| Weekly leadership sync | snapshot with `staff:priorities`, `staff:meeting_prep`, `staff:open_questions` | those tools | `staff.investor_update`, cross-task files |
| Investor update | snapshot with `staff:investor_update`, `staff:decision_log` | those tools | `staff.meeting_prep`, `staff.payroll` |

Both Tasks enter through `AetherPlatform.ensureWorker` / `createTask` / `startTask` — the same public surface Harbor and Claims use. Tools execute as `DIRECT_TOOL` on the registered-tool path. No new KnownActionName, policy case, or workstation executor.

## Infra the vertical had to add

`registerWorker({ kind: "chief_of_staff", createPlanner, capabilities })` in `packages/vertical-staff` — the same map Harbor and Claims use. No kernel `nextIntent` switch. Tools still execute as `DIRECT_TOOL` on the registered-tool path.

See [docs/REGISTRY.md](REGISTRY.md).

## Founder report

**What works.** One Worker (`wkr_chief_of_staff`) across two Tasks. Weekly prep writes priorities, meeting prep, and open questions from attached notes. Investor draft writes the update and a decision log from a different pack. The weekly Task is denied `staff.investor_update` and a cross-task payroll path. The investor Task is denied internal meeting prep and undeclared `staff.payroll`. Denies land in the JSONL audit. The environment is destroyed; artifacts remain. Desk buttons queue the same way Claims does; the live page starts the run.

**What is mocked.** No live LLM. The CoS agent is a deterministic planner, same class of dogfood as Claims. Payroll is not a real payroll system — it is an undeclared tool that policy denies by default. Isolation is `unshare-mount` when Docker is not healthy on the host. Alpha — not for sensitive production workloads.

**How much infra the vertical reinvented.** Almost none. Domain, agent, registered tools, fixtures, two desk buttons, CLI aliases, tests. Registration is `registerWorker` — not a kernel switch. Evidence **for** the thesis: Instinct-for-X no longer needs a private dispatch line.

**One next step.** Isolate the planner process from the control plane — still not a compiler.
