# Platform Milestone 2 — embedded third-party agent

**Alpha — not for sensitive production workloads.**

The default second-worker demo is the **Echo clerk** (`packages/vertical-echo`). It is a stranger package. The host loads it from `aether.verticals.json`. It is not listed in `builtins.ts`.

| Request | Decision |
| --- | --- |
| `echo.write` | ALLOW |
| `echo.secrets` | DENY |

Same WorkerEnvironment, identity, capabilities, policy, audit, and tear-down. There is no second control plane.

```bash
pnpm aether echo
pnpm aether show <taskId>
```

Or assign **Echo clerk** on the desk.

Cedarline Claims is extra dogfood on the same plane (ALLOW read/update, REQUIRE APPROVAL pay, DENY unrelated). It is not the OEM proof and is not a product line.

```bash
pnpm aether claims
pnpm aether approve <taskId> <approvalId>
pnpm aether accept <taskId>
```

See [REGISTRY.md](REGISTRY.md) for `registerWorker` from an external package.
