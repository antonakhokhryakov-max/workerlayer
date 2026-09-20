# OEM second worker — copy Echo

**Alpha — not for sensitive production workloads.** Synthetic files only.

WorkerLayer is the platform for deploying autonomous AI workers. The **Echo clerk** is the default second Worker — a stranger package, not the product. ALLOW `echo.write`. DENY `echo.secrets`. Harbor and Claims are extra dogfood, not this story.

You do **not** edit `runtime/src/builtins.ts`. That file only wires the `/api/v1` developer worker (you send the request list; empty planner).

## Outsider registerWorker checklist

1. Package exports `register()` that calls `registerWorker({ kind, name, createPlanner, capabilities, defaultTools })`.
2. `AETHER_API_KEY` is identity only. It does not grant tools. The CapabilityManifest does. Keyed `POST /api/v1/grant` with a selected tool list and `confirm: true` is the human’s explicit grant act — the API key never unlocks tools by itself. Key alone or empty tools → **400**. Desk grantor remains `desk-session`.
3. The planner / `/api/v1` loop **requests** only. It does not authorize, grant, or provision environments.
4. Platform success is ALLOW / ALLOW / DENY: `notes.read` → `notes.write` → `notes.export` (`pnpm example`). Echo itself is ALLOW `echo.write`, DENY `echo.secrets`.
5. Do not edit `runtime/src/builtins.ts`. Copy this package instead.

## Recipe (minutes, not a compiler)

1. Copy `packages/vertical-echo` (or start a package next to it).
2. Export `register()` that calls `registerWorker({ kind, name, createPlanner, capabilities, defaultTools })`. The planner **requests** tools. It does not authorize, grant, or provision environments.
3. List the package in `aether.verticals.json` at the repo root. Echo is first on purpose:

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

4. CLI, tests, and the planner child call `loadVerticals()`. That is config-only — a real `import()` from the JSON. No kernel edit. No `load-host-verticals.ts` edit.
5. **Desk:** prefer the same JSON. First-party packages are on a static map in `src/lib/load-host-verticals.ts` because Next cannot `import(variable)` TypeScript through the bundler. A leftover (your copied package) is loaded config-only via tsx. That map is not the kernel and not `builtins.ts`. If config-only load fails, the desk error tells you to add a compiled `.js` main **or** one static import — still not a builtins edit.

```ts
import { register as registerEchoClerk } from "../../packages/vertical-echo/src/index";
// HOST_LOADERS["./packages/vertical-echo"] = () => registerEchoClerk();
```

6. Do not add a `WorkerKind` switch. Do not add a policy case unless you invent a new first-party tool (you should not). Unknown tools are denied.

OEM does not choose Docker vs unshare. Compute is sticky per Task. The audit records the provider.

## Prove it

```bash
pnpm aether echo
pnpm aether show <taskId>
```

Or assign **OEM second worker — Echo clerk** on the desk. You should see ALLOW `echo.write`, DENY `echo.secrets`, environment destroyed.

Outsiders who are not standing up a vertical use the keyed 15-minute path instead: [ALPHA.md](ALPHA.md) (`pnpm example`) — ALLOW `notes.read` / ALLOW `notes.write` / DENY `notes.export`.

## FAQ

**Do I have to edit `load-host-verticals.ts`?** Not for CLI, tests, or a leftover listed only in `aether.verticals.json`. The desk static map is a Next bundler shortcut for first-party packages. WorkerLayer retries leftovers with tsx (config-only). Edit that file only if the leftover error says tsx could not load your TypeScript.

**Do I need Harbor fixtures, tesseract, or OCR?** No. Those are knowledge-work dogfood. The OEM proof is Echo. The 15-minute outsider proof is `pnpm example` (python3 stdlib). Skip `pnpm fixtures` and `apt-get tesseract` until you assign Harbor.

**What are Claims and North Dock?** Extra dogfood on the same WorkerEnvironment. Not the product. Not the OEM template. Echo is.

**Why does `builtins.ts` exist?** It registers the `/api/v1` developer worker (empty planner; you send the request list). Echo, Harbor, Claims, and Staff do not belong there.

See [REGISTRY.md](REGISTRY.md) for the longer leak list. Package paths still say `@aether/*`. The product name is WorkerLayer. Echo is not the product.

## See also

- 15-minute keyed path: [ALPHA.md](ALPHA.md)
- Cold start estimates: [DX.md](DX.md)
- Desk: [https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com) (temporary Alpha tunnel). Success: DENY in the audit, environment torn down.
