import { Injectable } from "@nestjs/common";
import { ILLMProvider } from "./llm.provider";
import { OpenAIProvider } from "./providers/openai.provider";
import { ClaudeProvider } from "./providers/claude.provider";
import { GeminiProvider } from "./providers/gemini.provider";

@Injectable()
export class LLMFactory {
  private providers = new Map<string, () => ILLMProvider>();
  private instances = new Map<string, ILLMProvider>();

  constructor() {
    this.providers.set("openai", () => new OpenAIProvider());
    this.providers.set("claude", () => new ClaudeProvider());
    this.providers.set("gemini", () => new GeminiProvider());
  }

  getProvider(name?: string): ILLMProvider {
    const providerName = name || process.env.LLM_PROVIDER || "openai";
    const createProvider = this.providers.get(providerName);
    if (!createProvider) {
      throw new Error(
        `LLM provider "${providerName}" not found. Available: ${Array.from(this.providers.keys()).join(", ")}`,
      );
    }
    const existing = this.instances.get(providerName);
    if (existing) return existing;
    const provider = createProvider();
    this.instances.set(providerName, provider);
    return provider;
  }
}
