# Milestone 1 — WorkerEnvironment

Platform thesis: we build the governed execution environment autonomous AI workers need.

This slice ships:

- `WorkerEnvironmentSpec` + `WorkerEnvironment`
- Task identity
- Declared capabilities
- Policy decisions
- Unified controlled tool execution
- Two real substrates behind one control plane: `spreadsheet.create` (DIRECT_TOOL) and `python.execute` (SANDBOX)
- Allowlisted fetch kept as a thin adapter in the BROWSER slot
- Dogfood knowledge worker that only requests tools
- Audit and lifecycle tear-down
- A visible DENY for a cross-task file or an undeclared capability

The EnvironmentCompiler is a stub. It copies a declared spec. It does not infer capabilities from the goal.

Harbor, Ironwharf, the market pack, and Fir Ridge remain as dogfood assignments on this environment.

Not built: Claims agent, public API/SDK, DX benchmark, a real compiler, MCP, a full computer, a browser, enterprise SSO.

See [docs/PLATFORM-M1.md](PLATFORM-M1.md).
