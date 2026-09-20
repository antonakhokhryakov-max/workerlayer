# Milestone 2 — embedded Claims Agent

Platform thesis: a second worker, from a legacy software company, runs on the **same** WorkerEnvironment.

See [docs/PLATFORM-M2.md](PLATFORM-M2.md).

Cedarline Mutual’s claims agent requests `claims.read`, `claims.update`, `claims.pay`, and `unrelated.data`. The control plane allows read and update, holds pay for a human, and denies unrelated data. Identity expires on accept. The environment is torn down.

This is the OEM / embedded proof for H1. It is not a public API (M3), not a DX benchmark (M4), and not a real EnvironmentCompiler (M5).

Harbor and the first-party knowledge worker still use DIRECT_TOOL + SANDBOX as in Platform Milestone 1.

---

Earlier quality-loop notes (dogfood history) live in [docs/MILESTONE-3.md](MILESTONE-3.md) through [docs/MILESTONE-15.md](MILESTONE-15.md).
