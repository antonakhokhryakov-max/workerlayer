# Alpha onboarding

**Alpha — not for sensitive production workloads.** Synthetic or non-sensitive files only. This is not SSO, not billing, and not enterprise zero-trust.

You bring the agent. WorkerLayer is the platform for deploying autonomous AI workers — the WorkerEnvironment: browser/computer, identity, tools, policy, audit, lifecycle. Motto: Ideas → AI workers → real outcomes.

Success is **ALLOW / ALLOW / DENY** in the audit, not only finished work. Sample: `notes.read` ALLOW → `notes.write` ALLOW → `notes.export` DENY.

Package paths still say `@aether/*` and `AETHER_API_KEY`. The product name is WorkerLayer. Echo is the default second Worker, not the product. This is not a knowledge-worker GTM.

## Founding specs (Alpha)

1. **Control plane.** `Authorization: Bearer` or `X-Api-Key` is identity only. The CapabilityManifest decides tools. Missing key → 401 `missing_api_key`. Wrong key → 401 `invalid_api_key`. A Task owned by another principal is **404**. `/api/v1` is keyed. The assignment desk stays open for dogfood without a key.
2. **Agent runtime.** You bring the loop. `/api/v1` accepts a request list only — it does not spawn a planner. Sample: `notes.read` ALLOW → `notes.write` ALLOW → `notes.export` DENY. A stuffed grant is dropped. The agent cannot self-grant.
3. **Workstation.** Docker `ComputeProvider` is the auto-default when the daemon is healthy (`docker info`) and the local image exists (`python:3.12-slim`, or `AETHER_DOCKER_IMAGE`). Else `unshare-mount`. Else `process-filesystem`. The kind is sticky per Task. OEM packages and customers do not choose docker vs unshare, and they do not choose a substrate. The audit records the provider.
4. **Product UX.** Alpha banner, synthetic-only. 15-minute path below. Success = ALLOW / ALLOW / DENY. WorkerLayer is the platform. Echo is the default second Worker, not the product. Not Aether, not a knowledge-worker GTM.

## Openable desk

Founder path: open [https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com) → Alpha banner → Spin up a Worker (identity only) → goal → Grant selected → DENY trail. That URL is a **temporary** Cloudflare quick tunnel for Alpha access — not a lasting Vercel or production site.

If the tunnel dies, Founding Engineer keeps `pnpm dev` running on the build host, restarts `cloudflared tunnel --url` against that desk, and updates the hostname here (a quick tunnel mints a new URL each start).

This website is the **control surface**. WorkerEnvironment and sticky compute run on the **host** serving Tasks, not in the browser. No compute picker. Tear-down is server-side.

`AETHER_API_KEY` is identity only. It never appears in the frontend as a capability grant. Desk Grant selected uses grantor `desk-session`. Cross-principal lookup is **404**, not 403. Alpha — not for sensitive production workloads. Synthetic only.

## Stage-next (OEM / DX)

1. **Agent runtime — outsider `registerWorker` checklist.** Package exports `register()` that calls `registerWorker`. The API key is identity only. The loop requests tools; it does not authorize. Success: `notes.read` ALLOW → `notes.write` ALLOW → `notes.export` DENY. Do not edit `builtins.ts`.
2. **Control plane — two keys.** `test_cross_principal_404`: Bob cannot read Alice’s task or environment — **404**, not 403. Alice’s own Manifest still ALLOW / ALLOW / DENY.
3. **Workstation — sticky compute.** Docker if healthy, else unshare-mount. Sticky per Task. OEM does not choose. The audit records the provider on `environment.created`.
4. **Product UX.** Echo is the default second Worker on the desk. Success is ALLOW / ALLOW / DENY. WorkerLayer is the platform, not an Echo product.

## Outsider registerWorker checklist

1. Your package exports `register()` that calls `registerWorker({ kind, name, createPlanner, capabilities, defaultTools })`. Copy Echo — [OEM.md](OEM.md).
2. `AETHER_API_KEY` is who you are. It does not grant tools. The CapabilityManifest does.
3. The loop **requests** only. `/api/v1` accepts a request list and does not spawn a planner. A stuffed grant is dropped.
4. Success is `notes.read` ALLOW → `notes.write` ALLOW → `notes.export` DENY (`pnpm example`).
5. Do **not** edit `runtime/src/builtins.ts`. That file only wires the `/api/v1` developer worker.

## Sticky compute (OEM does not choose)

Docker `ComputeProvider` if the daemon is healthy (`docker info`) and the local image exists (`python:3.12-slim`, or `AETHER_DOCKER_IMAGE`). Else `unshare-mount`. Else `process-filesystem`. The kind is **sticky per Task**. OEM packages and `/api/v1` callers do not choose docker vs unshare, and they do not choose a substrate. Sending `computeProvider` on `create_environment` is ignored. The audit records the provider on `environment.created` (and again on destroy).

## 1. Set a key (outsider)

You are not editing the assignment desk. `/api/v1` is keyed.

```bash
cp .env.example .env
# put a string only you know in AETHER_API_KEY
pnpm install
pnpm dev
```

Leave that running on the host. Open the desk from a laptop at [https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com) (temporary Cloudflare tunnel to this Alpha host — not a lasting Vercel site). The desk stays open without this key (dogfood). Harbor / North Dock buttons are not the outsider API. Cold-start estimates: [DX.md](DX.md).

## 2. Run the sample

From the repo root, in another terminal:

```bash
pnpm example
```

Same thing: `python3 clients/python/example.py`. Python reads `AETHER_API_KEY` from the environment or `.env`. It sends `Authorization: Bearer <key>` (you may send `X-Api-Key` instead).

- Missing key → 401 `missing_api_key`
- Wrong key → 401 `invalid_api_key`
- The key is who you are, not what you may do. ALLOW / DENY still come from the tools you declared.

Keyed health (`GET /api/v1` / `Client.health()`) returns `product: WorkerLayer`, the motto, `stranger` (sticky compute + DENY-as-success in one line), and `compute.customerChooses: false`. Sending `computeProvider` or `substrate` on `POST /api/v1/environments` does nothing.

```python
from aether import Client
c = Client("http://127.0.0.1:43147")  # host running pnpm example — not a laptop URL
c.health()
```

## 3. See ALLOW / ALLOW / DENY (that is success)

`pnpm example` should print:

```
WorkerLayer — Alpha — not for sensitive production workloads
WorkerLayer Alpha — compute <docker|unshare-mount> (sticky per Task; you do not choose). Success is ALLOW / ALLOW / DENY in the audit, not only finished work. POST /api/v1/propose does not grant.
ALLOW  notes.read
ALLOW  notes.write
DENY   notes.export  Capability 'notes:export' is not granted for this task.
environment destroyed
identity expired
```

If you did not see a DENY, the run did not prove the product. Synthetic dock notes only. You declared the tools; WorkerLayer decided.

## 4. Two keys are two principals (404, not 403)

Optional extra principals: `AETHER_API_KEYS=bob-secret` (comma-separated) in addition to `AETHER_API_KEY`. Each key is its own principal. `test_cross_principal_404`: Bob cannot read Alice’s task or environment — **404**, not 403, and not a grant. Alice’s own Manifest still ALLOW `notes.read` / ALLOW `notes.write` / DENY `notes.export`. The key still never grants tools.

## 5. Register your own tool

Same host and key. A second sample declares tools WorkerLayer has never heard of (`wharf.stamp` allowed, `wharf.payroll` denied). You name the tool and send the request. Policy decides. A proposal from the EnvironmentCompiler does not name or grant these tools for you.

```bash
pnpm example:custom
```

Or `python3 clients/python/custom_tool.py`. You should see `ALLOW wharf.stamp`, `DENY wharf.payroll`, environment destroyed, identity expired.

## 6. Proposal is not a grant

`POST /api/v1/propose` (or `Client.propose(goal)` / `environmentCompiler.propose`) returns **sketch / suggested tools** only — an id, a hash, a reason per row. **`granted` is always false.** Status is `sketch`. It never writes a Manifest, never looks approved or enabled, and never picks Docker vs unshare or invents mounts. `EnvironmentCompiler.grantFromProposal` throws.

`POST /api/v1/grant` is the human step. You send the **selected** tools (not the whole sketch) and `confirm: true`. The API key is identity only — it does not grant. Desk or session human act required — no auto-grant. Grant is **Task-scoped**: one Manifest for one Task, not a standing ALLOW across Tasks. Untouched sketch rows stay off the Manifest as DENY leftovers, each with one short reason. Runtime stays request-only; each step still hits ALLOW / DENY / REQUIRE_APPROVAL. The grant audit records grantor, Task/Worker id, capabilities added/removed, sketch id/hash, and timestamp. Empty tools, missing confirm, Approve all, or a proposal with no selection → 400.

Keyed `POST /api/v1/grant` with a selected tool list and `confirm: true` is the human’s explicit grant act — the API key is identity only and never unlocks tools by itself. Key alone or empty tools → **400**. Desk grantor remains `desk-session`.

Human-approve example — review the sketch, Grant selected, confirm:

```python
from aether import Client
c = Client("http://127.0.0.1:43147")  # host running pnpm example — not a laptop URL
proposal = c.propose("Read the attached slip and write a hold notice. Do not export it.")
assert proposal["granted"] is False
assert proposal["status"] == "sketch"
# Look at proposal["suggestedTools"] and each reason. Do not paste them blindly.
chosen = [
    {"name": "notes.read", "capability": "notes:read", "policy": "allow"},
    {"name": "notes.write", "capability": "notes:write", "policy": "allow"},
    {"name": "notes.export", "capability": "notes:export", "policy": "deny"},
]
out = c.grant("dock-notes", chosen, confirm=True, proposal=proposal)
env, task = out["environment"], out["task"]
# Untouched sketch rows are DENY leftovers on this Task Manifest.
```

A proposal never writes `granted: true`. Grant-without-selection fails. The 15-minute example path is still ALLOW `notes.read` / ALLOW `notes.write` / DENY `notes.export`, then torn down.

## OEM proof (Echo)

The default second worker is the **Echo clerk** (`packages/vertical-echo`). Copy it — [OEM.md](OEM.md). Stranger package, not `builtins.ts`. ALLOW `echo.write`, DENY `echo.secrets`. **WorkerLayer is the platform. Echo is not the product.** Harbor and Claims are extra dogfood, not the GTM.

```bash
pnpm aether echo
```

## Honest limits

- One shared key per principal. Not per-user accounts. Not rotation. Not SSO. Not JWT scopes. The key never grants capabilities.
- The desk is temporarily public via a Cloudflare quick tunnel ([https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com)). Desk dogfood is unkeyed. Synthetic only. The tunnel dies with this host — not a lasting site. Origin is engineering source of truth. GitHub is a Vercel-import mirror only (not product SoT). Vercel is not connected. Control-surface split: `WORKERLAYER_HOST_URL` — [DESK-URL.md](DESK-URL.md).
- Keyed `/api/v1` on the same host still requires `AETHER_API_KEY`. Python samples default to the host running `pnpm example` — that is the example client, not a founder browser URL.
- You still bring the agent loop. `/api/v1` does not call a hosted model.
- Docker is selected only when `docker info` succeeds. This Alpha does not install a daemon for you.
- Same-machine residual risk: [SECURITY.md](SECURITY.md).

## See also

- Timed cold start and hard blockers: [DX.md](DX.md)
- Copy Echo (OEM second Worker): [OEM.md](OEM.md)
- Residual risk and identity ≠ authorization: [SECURITY.md](SECURITY.md)
- Desk: [https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com) — **temporary** Cloudflare tunnel. Durable URL plan: [DESK-URL.md](DESK-URL.md). Open a task and look for **DENY** and **torn down**. Review a sketch: you still choose what to grant.
- Mac mini host start (Origin root, `:43147`): [HOST-START.md](HOST-START.md). Not the GitHub desk mirror. Not `:8787`.
