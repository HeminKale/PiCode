import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Logger } from "@nestjs/common";
import { ILLMProvider, LLMRequest, LLMResponse } from "../llm.provider";

export class GeminiProvider implements ILLMProvider {
  name = "gemini";
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents: request.userPrompt,
      config: {
        systemInstruction: request.systemPrompt,
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 2000,
        responseMimeType: request.jsonMode ? "application/json" : undefined,
        // Gemini 3.5 Flash defaults to medium thinking. A low setting is enough
        // for deterministic schema generation and reserves the response budget
        // for the full flow JSON.
        thinkingConfig: request.jsonMode ? { thinkingLevel: ThinkingLevel.LOW } : undefined,
      },
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== "STOP") {
      this.logger.warn(
        `Gemini generation ended with ${candidate.finishReason}` +
          (candidate.finishMessage ? `: ${candidate.finishMessage}` : ""),
      );
    }

    return {
      content: response.text ?? "",
      tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
      model: response.modelVersion ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    };
  }
}
