import OpenAI from "openai";
import { ILLMProvider, LLMRequest, LLMResponse } from "../llm.provider";

export class OpenAIProvider implements ILLMProvider {
  name = "openai";
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      max_tokens: request.maxTokens ?? 2000,
      temperature: request.temperature ?? 0.7,
      response_format: request.jsonMode ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      tokensUsed: response.usage?.total_tokens ?? 0,
      model: response.model,
    };
  }
}
