import { DeterministicProvider } from "./deterministic";
import { OpenAIProvider } from "./openai";

export interface ModelProvider {
  readonly name: string;
  readonly kind: "deterministic" | "llm";
  complete(prompt: string): Promise<string>;
}

export function createModelProvider(
  env: NodeJS.ProcessEnv = process.env,
): ModelProvider {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    return new OpenAIProvider(apiKey, env.OPENAI_MODEL);
  }
  return new DeterministicProvider();
}
