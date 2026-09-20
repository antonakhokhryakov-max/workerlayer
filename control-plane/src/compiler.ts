import type { ExecutionSubstrate, WorkerEnvironmentSpec } from "@aether/contracts";
import { ALLOWLIST_FETCH_CAPABILITY, SANDBOX_EXECUTE_CAPABILITY } from "./capabilities";

/**
 * Milestone 1 EnvironmentCompiler.
 * It copies an explicitly declared spec. It does not infer capabilities,
 * pick substrates from the goal, or upgrade the assignment.
 * POST /api/v1/propose sketches tools for a human. It must not
 * call this compiler with inferred grants. EnvironmentCompiler.grantFromProposal
 * is a hard no. POST /api/v1/grant requires a human-selected tool list
 * and confirm: true — it never copies a sketch.
 */
export function substratesFromCapabilities(granted: string[]): ExecutionSubstrate[] {
  const substrates: ExecutionSubstrate[] = ["DIRECT_TOOL"];
  if (granted.includes(SANDBOX_EXECUTE_CAPABILITY)) substrates.push("SANDBOX");
  if (granted.includes(ALLOWLIST_FETCH_CAPABILITY)) substrates.push("BROWSER");
  return substrates;
}

export function declareWorkerEnvironment(input: {
  assignmentId: string;
  workerId?: string;
  capabilityManifestId?: string;
  granted: string[];
  denied: string[];
  approvedDestinations?: string[];
}): WorkerEnvironmentSpec {
  return {
    assignmentId: input.assignmentId,
    workerId: input.workerId,
    capabilityManifestId: input.capabilityManifestId,
    capabilities: [...input.granted],
    deniedCapabilities: [...input.denied],
    substrates: substratesFromCapabilities(input.granted),
    approvedDestinations: [...(input.approvedDestinations ?? [])],
    compiledFrom: "declared",
  };
}

export function compileDeclaredEnvironment(spec: WorkerEnvironmentSpec): WorkerEnvironmentSpec {
  if (spec.compiledFrom !== "declared") {
    throw new Error(
      "Milestone 1 EnvironmentCompiler only accepts explicitly declared capabilities.",
    );
  }
  return {
    assignmentId: spec.assignmentId,
    workerId: spec.workerId,
    capabilityManifestId: spec.capabilityManifestId,
    capabilities: [...spec.capabilities],
    deniedCapabilities: [...spec.deniedCapabilities],
    substrates: [...spec.substrates],
    approvedDestinations: [...spec.approvedDestinations],
    compiledFrom: "declared",
  };
}
