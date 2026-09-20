# Platform Milestone 1 — Worker infrastructure

**Alpha — not for sensitive production workloads.** Not enterprise zero-trust.

WorkerLayer is the platform for deploying autonomous AI workers. The customer brings the model, agent logic, domain, and UX. We provide the WorkerEnvironment: identity, capabilities, policy, environment, execution, lifecycle, and audit.

**BYOM.** We do not host models and we do not sell tokens. If you set `OPENAI_API_KEY`, it is your credential and your bill. The reference worker uses a deterministic local planner when no key is set.

## Hierarchy

```
Worker (persistent logical AI worker)
  └── Task (one assignment)
        └── CapabilityManifest (snapshot for this Task)
              └── WorkerEnvironment (composed for this run)
                    └── Execution (DIRECT_TOOL / SANDBOX / allowlisted fetch)
```

Harbor, Ironwharf, Fir Ridge, and the market pack are dogfood. North Dock’s chief of staff is the Instinct-for-X vertical on the same surface — domain logic, not a second platform. First-party and third-party workers register with `registerWorker`; the kernel does not switch on WorkerKind. The assignment desk creates and runs them through `AetherPlatform` (`ensureWorker` / `createTask` / `startTask`). There is no private kernel shortcut for those runs. The thin `/api/v1` from Milestone 3 is kept and not expanded. `EnvironmentCompiler` proposes tools for a human; it does not auto-grant.

## Compute — auto-default, sticky, OEM does not choose

Docker `ComputeProvider` is the default when the daemon is healthy (`docker info`). Otherwise `unshare-mount`. `process-filesystem` is a degraded last resort. The kind is sticky per Task (review/fix reuses the same provider). OEM packages and `/api/v1` cannot select docker vs unshare or pick a substrate. The audit records the provider on `environment.created`.

**This host:** if Docker is not healthy, unshare-mount is what runs. We do not install a daemon here and we do not add Daytona/E2B.

Swap point: `selectComputeProvider()`. Do not run two backends for one Task.

## Advertised capabilities

Only what already runs end-to-end:

- `files:read:task`
- `files:write:output`
- `code:execute:sandbox` (`python.execute`)
- `spreadsheet:create`
- `tool:invoke`
- `network:fetch:allowlist` (exact destinations on the Task; this is web.research when it is easy)

Harbor still grants extra first-party tools (PDF, quality, presentation) because those already work. Presentation was not a delay; the code was already there. Do not read that as a large connector surface.

## Policy

ALLOW | DENY | REQUIRE_APPROVAL. Unknown sensitive → DENY. Enforcement is outside the model. The agent cannot self-grant.

## Alpha security (real, not claimed)

- Task A cannot read Task B files through supported interfaces (policy, workspace jail, isolation probe).
- A missing capability is denied.
- Denied actions are recorded.
- Originals are not silently overwritten.
- Lifecycle cleanup tears the environment down and keeps outputs + audit.
- Audit is a JSONL file on disk, not model output.

See `tests/alpha-security.test.ts`.

## What this slice does not own

Model hosting, multi-cloud, SSO, SIEM, DLP, marketplace, billing, Windows, VPC, dozens of connectors, an elaborate frontend, public API expansion, Claims-as-product, Daytona/E2B.
