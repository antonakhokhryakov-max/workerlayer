# WorkerLayer

**The platform for deploying autonomous AI workers.**

Ideas → AI workers → real outcomes.

**Alpha — not for sensitive production workloads.** Synthetic or non-sensitive files only.

WorkerLayer is the WorkerEnvironment builders reuse across agents: browser/computer, identity, tools, policy, audit, and lifecycle. You bring the model, the agent logic, the domain, and the UX. We do not host models. We do not monetize tokens.

Success is **ALLOW / ALLOW / DENY** in the audit, not only finished work. Sample: `notes.read` ALLOW → `notes.write` ALLOW → `notes.export` DENY.

The test: can someone build “Instinct for X” mostly as a vertical layer on this?

Package paths still say `@aether/*`, `AetherPlatform`, `AETHER_API_KEY`, and `pnpm aether`. That is the local rename later. The product name is WorkerLayer.

## 15-minute path (keyed /api/v1)

No model API key. Harbor fixtures are **not** required for the first DENY. The API key is who you are, not what you may do.

```bash
cp .env.example .env
# set AETHER_API_KEY to a string only you know
pnpm install
pnpm dev
```

Leave that running on the host. In another terminal, from the repo root:

```bash
python3 clients/python/example.py
```

Or `pnpm example`. That sends the key to `/api/v1`. You declare a worker and tools; WorkerLayer decides allow / deny, then tears the environment down and expires the identity. You should see `ALLOW notes.read`, `ALLOW notes.write`, `DENY notes.export`, `environment destroyed`, and `identity expired`. Missing or wrong key is a 401. `pnpm example:custom` is a second sample: you register `wharf.stamp` (allow) and `wharf.payroll` (deny).

The assignment desk stays open without the key (dogfood). Open it at [https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com) — a **temporary** Cloudflare tunnel to this Alpha host. That is the website. Outsiders use the keyed API — [docs/ALPHA.md](docs/ALPHA.md). Timed notes: [docs/DX.md](docs/DX.md). Client notes: [clients/python/README.md](clients/python/README.md). `POST /api/v1/propose` is a sketch / suggested tools only — it does not grant and does not write a Manifest. `POST /api/v1/grant` is **Grant selected** (not Approve all): selected tools + `confirm: true`, Task-scoped. The API key alone does not grant. A human may still pass `tools=` to `create_environment`.

Mac mini host (WorkerEnvironment / `startTask` / Manifest): land this Origin tree at `~/Developer/workerlayer-origin` and follow [docs/HOST-START.md](docs/HOST-START.md). Do not run the host from the GitHub desk-only mirror at `~/Developer/workerlayer`. Desk `:8787` is not the host.

## OEM second worker — Echo

Copy `packages/vertical-echo` — [docs/OEM.md](docs/OEM.md). Stranger package, loaded from `aether.verticals.json`, not `builtins.ts`. ALLOW `echo.write`, DENY `echo.secrets`. **WorkerLayer is the platform. Echo is not the product.**

```bash
pnpm aether echo
```

## Alpha desk (open in a browser)

Open the WorkerLayer desk: **[https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com)**.

That URL is a **temporary Cloudflare quick tunnel** for Alpha access — not a lasting Vercel or production site. It dies when the host or `cloudflared` stops. Origin is engineering source of truth. GitHub is a Vercel-import mirror only (not product SoT): [https://github.com/antonakhokhryakov-max/workerlayer](https://github.com/antonakhokhryakov-max/workerlayer) exists; this agent cannot push yet. Vercel is not connected.

If the tunnel dies, Founding Engineer keeps `pnpm dev` running on the build host, restarts `cloudflared tunnel --url` against that desk, then updates `src/lib/public-desk.ts` (and this README) to the new trycloudflare hostname. A quick tunnel mints a **new URL each restart**. Lasting URL: GitHub mirror + Vercel control surface + Mac mini host — not live. GitHub repo exists at [https://github.com/antonakhokhryakov-max/workerlayer](https://github.com/antonakhokhryakov-max/workerlayer) (Vercel-import mirror, not SoT). This agent cannot push without `GH_TOKEN`. Temporary tunnel stays live. Compute stays host-side. See [docs/DESK-URL.md](docs/DESK-URL.md).

This website is the control surface. WorkerEnvironment and sticky compute run on the host serving Tasks, not in the browser. No compute picker. Tear-down is server-side. The Alpha key is identity only and is not a frontend grant. Desk Grant selected uses `desk-session`.

Harbor, Claims, and North Dock are extra knowledge-work dogfood on the same WorkerEnvironment. Echo is the default second Worker on the desk. Founding Engineer runs `pnpm example` on the build host for the keyed ALLOW / ALLOW / DENY proof. The desk you open is the tunnel URL above.

1. **Spin up the Echo Worker** — OEM second worker, Echo clerk, identity only. Then **Give Echo a sample job**. Then look for ALLOW `echo.write` and DENY `echo.secrets`. Sketch / Grant selected is the tools step if you are naming tools yourself.
2. Assign Harbor & Pine if you want longer knowledge-work dogfood (fixtures). Same Worker / Task / capabilities / policy / environment / audit surface.
3. Open a finished task and look for **DENY** and **torn down**. That is success.
4. Assign **North Dock chief of staff** only if you want Instinct-for-X on this plane. One persistent Worker, two Tasks, two CapabilityManifests.
5. Harbor, Claims, North Dock, and Echo each live in a **package** with `register()`. The host loads them from `aether.verticals.json` — not by editing `builtins.ts` (that file only wires `/api/v1`). Echo is listed first. See [docs/OEM.md](docs/OEM.md) and [docs/REGISTRY.md](docs/REGISTRY.md).
6. The planner / agent loop runs in a **separate process**, including a request-one-fix pass. Desk, CLI, and the public runtime class (`AetherPlatform`) always isolate. `isolatePlanner: false` is kernel debug only and cannot be set from a public API. A `/api/v1` request list is not a planner — those intents are sanitized and dispatched by the control plane. Same-machine residual risk is documented in [docs/SECURITY.md](docs/SECURITY.md).

This is not enterprise zero-trust.

Harbor dogfood and the North Dock chief of staff still go through the assignment desk or CLI after the 15-minute path. **Skip this for the 15-minute path.** OCR packages are Harbor-only.

```bash
# Harbor dogfood only — not required for pnpm example / Echo
sudo apt-get install -y tesseract-ocr poppler-utils ffmpeg python3
pnpm fixtures
pnpm test
```

Or:

```bash
pnpm aether echo
pnpm aether staff
pnpm aether investor
pnpm aether sample
pnpm aether show <taskId>
pnpm aether accept <taskId>
```

## Hierarchy

**Worker** (persistent logical AI worker) → **Task** (one assignment) → **CapabilityManifest** → **WorkerEnvironment** → **Execution**

The Worker survives across Tasks. Each Task still gets its own identity, capability snapshot, environment, and audit. This is not an account system and not a memory product.

## Compute

`ComputeProvider` auto-defaults to **Docker** when `docker info` succeeds, else **unshare-mount**, else **process-filesystem**. The kind is sticky per Task. OEM packages and customers do not choose the backend and do not choose a substrate (`POST /api/v1/environments` ignores `computeProvider` / `substrate`). The audit records the provider. Daytona/E2B are not integrated. This Alpha does not install a Docker daemon for you. On a host with no healthy Docker daemon, unshare-mount is what actually runs.

## Capabilities (advertised)

| Capability | What actually runs |
| --- | --- |
| `files:read:task` | Read files attached to this Task |
| `files:write:output` | Write artifacts for this Task |
| `code:execute:sandbox` | `python.execute` inside the Task environment |
| `spreadsheet:create` | DIRECT_TOOL spreadsheet |
| `tool:invoke` | Declared first-party / registered tools |
| `network:fetch:allowlist` | Exact destinations listed on the Task, if any |

Harbor still uses extra first-party tools that already work end-to-end (PDF, quality loop, presentation). Presentation is kept because the code already exists. Policy is ALLOW | DENY | REQUIRE_APPROVAL. Unknown sensitive actions are denied. The agent cannot grant itself access.

## Layers

| Layer | Folder | Trust |
| --- | --- | --- |
| Dogfood worker | `agents/` (child process) | Untrusted. Requests only. Speaks intents over IPC. |
| Control plane | `control-plane/` | Trusted. Decides ALLOW / DENY / REQUIRE APPROVAL. |
| Execution | `workstation/` | Untrusted. Runs only with a one-time grant. |
| Public surface | `runtime/` (`AetherPlatform` class) | Harbor, Claims, and the chief-of-staff vertical enter here. |

See [docs/HOST-START.md](docs/HOST-START.md), [docs/ALPHA.md](docs/ALPHA.md), [docs/DX.md](docs/DX.md), [docs/OEM.md](docs/OEM.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/PLATFORM-M1.md](docs/PLATFORM-M1.md), [docs/INSTINCT-STAFF.md](docs/INSTINCT-STAFF.md), [docs/REGISTRY.md](docs/REGISTRY.md), and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tests

```bash
pnpm test
```
