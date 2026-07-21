import { GoogleGenAI } from "@google/genai";
import { ILLMProvider, LLMRequest, LLMResponse } from "../llm.provider";

export class GeminiProvider implements ILLMProvider {
  name = "gemini";
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
      contents: request.userPrompt,
      config: {
        systemInstruction: request.systemPrompt,
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 2000,
        responseMimeType: request.jsonMode ? "application/json" : undefined,
      },
    });

    return {
      content: response.text ?? "",
      tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
      model: response.modelVersion ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite",
    };
  }
}
