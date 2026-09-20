# Architecture

WorkerLayer is the platform for deploying autonomous AI workers. Motto: Ideas → AI workers → real outcomes.

**Alpha — not for sensitive production workloads.**

```
operator assigns a goal + files
        ↓
persistent Worker  (wkr_knowledge | wkr_claims | wkr_developer)
        ↓
Task  →  CapabilityManifest snapshot
        ↓
EnvironmentCompiler (propose sketches tools; compile copies a declared spec; never auto-grants)
        ↓
WorkerEnvironment  = spec + identity + capabilities + substrate adapters + compute HOW
        ↓
planner process (untrusted)  — intents only
        ↓ IPC: tool request / result
control plane (trusted parent)  ALLOW | DENY | REQUIRE APPROVAL
        ↓
substrate adapter executes (DIRECT_TOOL | SANDBOX | allowlisted fetch)
        ↓
audit on disk + tear-down
```

The planner is a child process. It does not hold grants and does not import the workstation. See [docs/SECURITY.md](SECURITY.md).

Harbor dogfood enters through `AetherPlatform`. The kernel looks up a **registration map**. The default second worker is the Echo clerk (`packages/vertical-echo`) — a stranger package, not `builtins.ts`. Harbor, Claims, and North Dock register the same way. `builtins.ts` only wires the `/api/v1` developer worker. See [docs/REGISTRY.md](REGISTRY.md).

**Substrates (what):** `DIRECT_TOOL` | `MCP_TOOL` | `BROWSER` | `SANDBOX` | `COMPUTER`

Milestone 1 executes **DIRECT_TOOL** and **SANDBOX**. Allowlisted fetch reuses the `BROWSER` slot; it is not a browser. `MCP_TOOL` and `COMPUTER` are declared slots only.

**Compute HOW:** `selectComputeProvider()` auto-defaults to Docker when the daemon is healthy, else `unshare-mount`, else `process-filesystem`. Sticky per Task. Customers do not choose.

**Trust:** control plane is trusted. Execution is untrusted. Agent intent is not authorization. Being first-party is not a bypass.

Claims remains a demo of an extra worker. The default second-worker proof is the Echo clerk (external package). The thin `/api/v1` is a keyed local developer API — see [ALPHA.md](ALPHA.md).

See [docs/PLATFORM-M1.md](PLATFORM-M1.md) and [docs/SECURITY.md](SECURITY.md).
