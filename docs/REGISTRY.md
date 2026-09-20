# Register a vertical

**Alpha — not for sensitive production workloads.**

Copy [OEM.md](OEM.md) if you want the short recipe. Echo (`packages/vertical-echo`) is the stranger-package template — the default second Worker, not the product. It is listed first in `aether.verticals.json`. Harbor, Claims, and North Dock register the same way. A third-party vertical does **not** belong in `builtins.ts`.

Outsider `registerWorker` checklist: package exports `register()` that calls `registerWorker`; API key is identity only; request-only loop; success is `notes.read` ALLOW → `notes.write` ALLOW → `notes.export` DENY; do not edit `builtins.ts`.

WorkerLayer’s kernel does not switch on `WorkerKind`. `builtins.ts` only wires the `/api/v1` developer worker (empty planner; you send the request list).

This is not a compiler. This is not an API expansion.

## What you bring

1. Your own package. Examples: `packages/vertical-echo`, `packages/vertical-knowledge`.
2. A `register()` export that calls `registerWorker`.
3. A planner: `plan` / `nextIntent` / `observe`. It requests tools. It does not authorize.
4. Registered tools on the Task (`{ name, capability, policy }`). Unknown tools are denied.

## What you do not rebuild

Identity, policy, isolation, audit, lifecycle, WorkerEnvironment, ComputeProvider. You do not edit `runtime/src/kernel.ts` or `runtime/src/builtins.ts`.

## Host load (documented entry)

Put the package path in `aether.verticals.json` at the process working directory:

```json
{
  "verticals": [
    "./packages/vertical-echo",
    "./packages/vertical-knowledge",
    "./packages/vertical-claims",
    "./packages/vertical-staff"
  ]
}
```

Or set `AETHER_VERTICALS=./packages/vertical-echo`.

The host calls `loadVerticals()` at start (CLI, planner child, tests). That is config-only from `aether.verticals.json`. The assignment desk uses a static map in `src/lib/load-host-verticals.ts` for first-party packages because Next cannot `import(variable)` TypeScript through the bundler. Leftover paths retry config-only via tsx. That map is not the kernel and not `builtins.ts`. See [OEM.md](OEM.md).

```ts
import { loadVerticals, AetherPlatform } from "@aether/runtime";

await loadVerticals(); // reads aether.verticals.json
const plat = new AetherPlatform();
const worker = plat.ensureWorker("echo_clerk");
```

Your package:

```ts
import { registerWorker } from "@aether/runtime";

export function register() {
  registerWorker({
    kind: "echo_clerk",
    name: "Echo clerk",
    capabilities: (brief, root) => developerWorkerCapabilities(root, brief),
    createPlanner: () => new EchoClerk(),
    defaultTools: [{ name: "echo.write", capability: "echo:write", policy: "allow" }],
  });
}
```

See `packages/vertical-echo/` and [OEM.md](OEM.md). That package is the OEM second-worker demo.

## Remaining leaks

- `runDeveloperTask(brief, requests)` still exists for the thin `/api/v1` path. It is a sanitized request list through the control plane — no planner, no in-process agent.
- Knowledge-work effort packs (Harbor vs diligence vs market) are still inferred from the goal.
- The registry is loaded in both processes (last write wins in each). CLI, tests, and the planner child use `loadVerticals()` (config-only from `aether.verticals.json`). The assignment desk maps first-party paths to a static import in `src/lib/load-host-verticals.ts` because Next cannot `import(variable)` TypeScript through the bundler. Leftovers retry with tsx.
- First-party planners still import `@aether/agent` (the in-repo Harbor / Claims / CoS agent modules). Moving registration out of `builtins.ts` is not a sealed plugin sandbox.
- Same-machine residual risk: see [docs/SECURITY.md](SECURITY.md).

## Founder report

**What works.** Harbor, Claims, North Dock, and Echo each live in a package with `register()`. None of those four are listed in `builtins.ts`. Echo is first in `aether.verticals.json`. The desk OEM button is Echo. Copy that package — do not edit builtins.

**Remaining leaks.** Same-machine residual risk. Desk first-party packages still use a static import map; leftovers are config-only via tsx. Agent logic for Harbor/Claims/CoS is still in `agents/`. Not a compiler.

**One next step.** Pause isolation. Try the Alpha `/api/v1` path, then a desk assignment.
