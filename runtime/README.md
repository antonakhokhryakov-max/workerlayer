# Trusted runtime

The only place the layers meet:

**isolated planner requests over IPC → control plane decides → substrate adapter executes → audit**

`AetherPlatform` is the public surface. Harbor and Claims enter here as Worker → Task → CapabilityManifest → WorkerEnvironment. The kernel is internal. `EnvironmentCompiler.propose` is a sketch only — never a Manifest. A human grant is `POST /api/v1/grant` with **Grant selected** tools (`confirm: true`). Task-scoped. The API key alone does not grant.

**Alpha — not for sensitive production workloads.**
