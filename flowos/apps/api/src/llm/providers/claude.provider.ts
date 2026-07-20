import Anthropic from "@anthropic-ai/sdk";
import { ILLMProvider, LLMRequest, LLMResponse } from "../llm.provider";

export class ClaudeProvider implements ILLMProvider {
  name = "claude";
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      max_tokens: request.maxTokens ?? 2000,
      temperature: request.temperature ?? 0.7,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
    });

    const block = response.content[0];
    const content = block?.type === "text" ? block.text : "";

    return {
      content,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      model: response.model,
    };
  }
}
