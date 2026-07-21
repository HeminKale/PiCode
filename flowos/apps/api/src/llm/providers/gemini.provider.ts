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
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const thinkingConfig = request.jsonMode
      ? model.startsWith("gemini-2.5")
        ? { thinkingBudget: 0 }
        : { thinkingLevel: ThinkingLevel.LOW }
      : undefined;

    const response = await this.client.models.generateContent({
      model,
      contents: request.userPrompt,
      config: {
        systemInstruction: request.systemPrompt,
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 2000,
        responseMimeType: request.jsonMode ? "application/json" : undefined,
        // Workflow JSON is deterministic. Disabling 2.5 Flash thinking preserves
        // response capacity; Gemini 3 models use their supported LOW setting.
        thinkingConfig,
      },
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason !== "STOP") {
      this.logger.warn(
        `Gemini generation ended with ${candidate?.finishReason ?? "unknown"}` +
          (candidate?.finishMessage ? `: ${candidate.finishMessage}` : ""),
      );
    }

    return {
      content: response.text ?? "",
      tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
      model: response.modelVersion ?? model,
    };
  }
}
