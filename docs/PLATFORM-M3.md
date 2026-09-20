# Platform Milestone 3 — minimal developer API

**Paused.** Milestone 1 realignment is the current product slice. This thin local API remains; it is not being expanded.

A thin HTTP API plus a one-file Python client. You declare a worker, its tools, and its policy. WorkerLayer composes **Worker → Task → CapabilityManifest → WorkerEnvironment**. You do not edit the assignment desk.

Harbor and the Cedarline Claims Agent still use the same control plane. This is not a large SDK. The EnvironmentCompiler is thin: `propose` sketches tools, `compileDeclared` copies a declared spec, `grantFromProposal` throws. The 15-minute public path is `python3 clients/python/example.py` (or `pnpm example`) after `AETHER_API_KEY` and `pnpm dev` on http://127.0.0.1:43147. See [ALPHA.md](ALPHA.md), [clients/python](../clients/python/README.md), and [DX.md](DX.md).


## What you can call

| Action | Method |
| --- | --- |
| Health (keyed) | `GET /api/v1` |
| Propose tools from goal text (does **not** grant) | `POST /api/v1/propose` |
| Human grant-review (selected tools + `confirm: true`, Task-scoped) | `POST /api/v1/grant` |
| Create WorkerEnvironment | `POST /api/v1/environments` |
| Inspect environment | `GET /api/v1/environments/:id` |
| Register tools | `POST /api/v1/environments/:id/tools` |
| Declare capabilities | `POST /api/v1/environments/:id/capabilities` |
| Create task | `POST /api/v1/tasks` |
| Attach files | `POST /api/v1/tasks/:id/files` |
| Run task | `POST /api/v1/tasks/:id/run` |
| Inspect status | `GET /api/v1/tasks/:id` |
| Retrieve audit | `GET /api/v1/tasks/:id/audit` |
| Retrieve outputs | `GET /api/v1/tasks/:id/outputs` |
| Destroy environment | `POST /api/v1/environments/:id/destroy` |

You bring the agent loop: `run` takes the tool requests. Those intents are sanitized and executed only through the control plane. There is no in-process planner and no grant object on the request. ALLOW / DENY / REQUIRE APPROVAL still happen in the parent. Registered tools execute as `DIRECT_TOOL`.

Every `/api/v1` call needs `AETHER_API_KEY` (`Authorization: Bearer` or `X-Api-Key`). Missing → 401 `missing_api_key`. Wrong → 401 `invalid_api_key`. The key identifies a principal; it does not grant tools. The assignment desk does not use it. See [ALPHA.md](ALPHA.md).

## Honest friction

- One shared local key per principal. Not SSO. Not JWT scopes. If `AETHER_API_KEY` is unset, `/api/v1` refuses all calls. A Task owned by another principal is 404. Do not put the API on a public network.
- Isolation is still composed when the task **runs**, then torn down when the run ends. `create_environment` stores the declared spec. `destroy_environment` retires that spec and expires identities.
- Tool names cannot shadow first-party tools (`claims.pay`, `spreadsheet.create`, …).
- There is no hosted model. You send the requests.
- The EnvironmentCompiler still copies a declared spec. `POST /api/v1/propose` / `environmentCompiler.propose` is a **sketch** (`granted: false`, status `sketch`). It does **not** grant, does not write a Manifest, and does not pick Docker vs unshare or invent mounts. `grantFromProposal` is a hard no. `POST /api/v1/grant` needs the **selected** tools (not the whole sketch) and `confirm: true` — Task-scoped, not a standing ALLOW. The API key alone does not grant.
