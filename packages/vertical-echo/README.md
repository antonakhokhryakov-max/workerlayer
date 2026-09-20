# Echo clerk — OEM stranger package

**Alpha — not for sensitive production workloads.**

This is the WorkerLayer OEM template — the default second Worker, not an Echo product. It is **not** listed in `builtins.ts`. The host loads it from `aether.verticals.json` (or `AETHER_VERTICALS`) via `loadVerticals()`. Copy this package to stand up a second worker. Recipe: [docs/OEM.md](../../docs/OEM.md).

It owns:

- `echo_clerk` WorkerKind
- planner (`EchoClerk`)
- registered tool `echo.write`

It does not own identity, policy, isolation, audit, or environments. Secrets (`echo.secrets`) are denied by the control plane.

```ts
import { register } from "@example/vertical-echo";
register();
```

Or let the host do it. Echo is first in the repo config on purpose:

```json
{ "verticals": ["./packages/vertical-echo"] }
```

Desk (Next): first-party packages use one static import in `src/lib/load-host-verticals.ts`. A leftover listed only in `aether.verticals.json` is loaded config-only (tsx). Do not edit `runtime/src/builtins.ts`. See [docs/OEM.md](../../docs/OEM.md).
