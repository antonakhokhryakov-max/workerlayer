import type { ModelProvider } from "./provider";

export class OpenAIProvider implements ModelProvider {
  readonly name = "openai";
  readonly kind = "llm" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  ) {}

  async complete(prompt: string): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a knowledge-work analyst. Return concise, structured output only. You cannot access files or send data yourself.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${body}`);
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? "";
  }
}
