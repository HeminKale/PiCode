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
    // Gemini 2.5 models accept a numeric thinkingBudget; Gemini 3.x models (3, 3.1,
    // 3.5, ...) replaced that with the thinkingLevel enum and ignore thinkingBudget.
    // Sending the wrong shape doesn't error — it just leaves thinking at its default
    // (medium for 3.x), which silently eats most of maxOutputTokens on reasoning
    // before any JSON gets written, truncating the response.
    const thinkingConfig = request.jsonMode
      ? model.startsWith("gemini-2.5")
        ? { thinkingBudget: 0 }
        : { thinkingLevel: ThinkingLevel.MINIMAL }
      : undefined;

    const response = await this.client.models.generateContent({
      model,
      contents: request.userPrompt,
      config: {
        systemInstruction: request.systemPrompt,
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 2000,
        responseMimeType: request.jsonMode ? "application/json" : undefined,
        // Workflow JSON is deterministic — minimize thinking overhead so the
        // token budget goes to the actual output, not internal reasoning.
        thinkingConfig,
      },
    });

    const candidate = response.candidates?.[0];
    const usage = response.usageMetadata;
    // Logged unconditionally while we're chasing truncated flow-generation output:
    // this is the only way to tell "thinking ate the budget" (high thoughtsTokenCount,
    // finishReason MAX_TOKENS) apart from a safety/recitation stop or a lower real
    // per-request cap than maxOutputTokens implies.
    this.logger.warn(
      `Gemini finishReason=${candidate?.finishReason ?? "unknown"} ` +
        `prompt=${usage?.promptTokenCount ?? "?"} thoughts=${usage?.thoughtsTokenCount ?? "?"} ` +
        `candidates=${usage?.candidatesTokenCount ?? "?"} total=${usage?.totalTokenCount ?? "?"}` +
        (candidate?.finishMessage ? ` message=${candidate.finishMessage}` : ""),
    );

    return {
      content: response.text ?? "",
      tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
      model: response.modelVersion ?? model,
    };
  }
}
