# Security foundations (Alpha)

**Alpha — not for sensitive production workloads.**

WorkerLayer’s control plane is a **foundation**, not production zero-trust and not enterprise security. It is designed so a customer’s agent can sit in front of the same Worker / Task / CapabilityManifest / WorkerEnvironment. It is not Okta, SIEM, DLP, or a hardened VPC.

**Identity ≠ authorization.** `Authorization: Bearer` or `X-Api-Key` is identity only. The CapabilityManifest decides tools. The key is who you are, not what you may do. Same as [ALPHA.md](ALPHA.md).

## What exists today

- **Persistent Worker** — one logical worker per kind (`wkr_knowledge`, …). Tasks hang off it. Not an account system.
- **Task worker identity** — each assignment issues a temporary `wrk_*` identity with an expiration. When the assignment is accepted or rejected, the identity is expired. Outputs and the audit remain.
- **CapabilityManifest** — granted / denied / require-approval snapshotted onto the Task. The agent cannot add to it.
- **Policy outside the model** — ALLOW | DENY | REQUIRE_APPROVAL. Unknown sensitive actions are denied. Denied actions are appended to `data/tasks/<id>/audit.jsonl`.
- **One-time grants** — the workstation will not execute without a control-plane grant for that exact request. The planner never holds the grant registry.
- **Planner process boundary** — the assignment desk, CLI, `AetherPlatform`, and review/fix always isolate the planner. The child speaks intents only. The parent decides ALLOW / DENY and holds grants. Intents are sanitized: `requestedBy` is forced to `agent`; grant and decision fields are stripped.
- **Developer request lists** — `/api/v1` and `runDeveloperTask` do not spawn a planner and do not build an in-process agent. The client already sent tool intents. Those are sanitized and dispatched by the control plane. A stuffed grant is dropped. Deny and teardown still happen in the parent.
- **`/api/v1` API key** — HTTP calls require `AETHER_API_KEY` (`Authorization: Bearer` or `X-Api-Key`). Missing key → 401 `missing_api_key`. Wrong key → 401 `invalid_api_key`. Identity ≠ authorization: the key is an identity / principal only. It never grants capabilities. ALLOW / DENY still come from the CapabilityManifest. A Task owned by another principal is **404**, not 403. No JWT scopes and no SSO. The assignment desk stays open without a key. Alpha desk access is a temporary Cloudflare quick tunnel ([https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com)) — unkeyed dogfood, synthetic only, dies with this host. Keyed `/api/v1` on that same URL still requires `AETHER_API_KEY`. That is not a lasting public control plane. `POST /api/v1/propose` is a sketch only — it never writes a Manifest. Keyed `POST /api/v1/grant` with a human-selected tool list and `confirm: true` is the human’s explicit grant act — the API key is identity only and never unlocks tools by itself. The API key alone does not grant. Key alone or empty tools → **400**. Desk grantor remains `desk-session`. It does not copy a sketch. Grant is Task-scoped (not a standing ALLOW). The audit records grantor, Task/Worker id, capabilities added/removed, sketch id/hash, and timestamp.
- **Immutable originals** — uploaded sources are copied to `originals/` and cannot be overwritten through the workstation. Re-sealing does not replace an existing original.
- **Task file boundaries** — no absolute paths, no `..`, no other-task paths, no writes outside `artifacts/` and `findings.json`.
- **Task-scoped execution environment** — one `ComputeProvider`, auto-selected: Docker when `docker info` succeeds, else `unshare-mount`, else `process-filesystem`. Sticky per Task. Customers do not choose the backend. When the run ends the environment directory is deleted. Artifacts and the audit stay on the store (`data/tasks/<id>/`).

## What isolation actually buys

If the **agent behaves incorrectly** — asks for another task’s files, an undeclared capability, or a host path — three independent checks fire:

1. Policy denies the request (capability + path + cross-task rules).
2. The task workspace refuses path escape in-process.
3. From inside the mount-namespace environment, those files are not present.

The **planner process** adds a fourth check on the happy path:

4. The planner cannot call workstation APIs or issue grants. It can only send an intent over IPC. A stuffed `grant` or a forged `requestedBy: "control-plane"` is dropped before `dispatch`. Deny still happens in the parent.

That limits blast radius of a sloppy worker. It is not a product you would put on a bank network.

## Debug-only — not a product switch

`isolatePlanner: false` and `AETHER_PLANNER_ISOLATE=0` put the planner back in-process. They exist so someone can debug the kernel on their machine.

They **cannot** be set from the assignment desk, the CLI, `/api/v1`, or `AetherPlatform`. Those surfaces always pass `isolatePlanner: true`. Review/fix always spawns the child. Setting the env var and then using the desk still isolates.

The only way to turn isolation off is to call the kernel (`runKnowledgeTask`, `runRegisteredTask`) yourself and pass `isolatePlanner: false`, or omit the flag while `AETHER_PLANNER_ISOLATE=0`. That is a debug path. It is not exposed on a public API.

## What this would not stop

If the **host process is fully compromised** — an attacker who can already run as the WorkerLayer Node user — these controls fail:

- Planner and control plane are still the same machine and the same Unix user. This is a process boundary, not a VM, not a separate UID, not seccomp, not a network namespace.
- The child can theoretically `import` `ControlPlane` or `GrantRegistry` from disk. We do not hand it those objects, and `planner-host.ts` does not import them. There is no module firewall.
- `unshare-mount` is a user namespace plus chroot, not a VM. `/usr` is bound so OCR tools can run.
- The fallback `process-filesystem` provider is a degraded directory plus the JavaScript path jail.
- There is no independent policy host, no secret vault, and no hardware isolation.

## Remaining leaks (honest)

- Same-machine residual risk, above.
- A custom `ModelProvider` object cannot cross the process boundary. The child builds its own provider from the environment (or `DeterministicProvider` when the parent used that path).
- `builtins.ts` still imports capability helpers from `@aether/control-plane`. Loading that module in the child is not the same as holding grants, but it is not a sealed plugin sandbox.
- Calling the kernel directly with `isolatePlanner: false` is still possible for local debug.
- The `/api/v1` key is a principal, not a capability. Anyone who can read `.env` can call the API as that principal. The assignment desk is still unauthenticated. Cross-principal Task lookup returns 404.

## See also

- Outsider keyed path and identity-only key: [ALPHA.md](ALPHA.md)
- Cold start: [DX.md](DX.md)
- Copy Echo: [OEM.md](OEM.md)
