import type { ModelProvider } from "./provider";

/**
 * Default provider when no model API key is set.
 * Returns enough structure for the knowledge worker to finish a task
 * from attached materials without calling a remote model.
 */
export class DeterministicProvider implements ModelProvider {
  readonly name = "deterministic";
  readonly kind = "deterministic" as const;

  async complete(prompt: string): Promise<string> {
    return [
      "Deterministic provider is active (no model API key).",
      "Use heuristic analysis of attached materials.",
      prompt.slice(0, 120),
    ].join("\n");
  }
}
