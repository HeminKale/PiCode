import { Injectable } from "@nestjs/common";
import { ILLMProvider } from "./llm.provider";
import { OpenAIProvider } from "./providers/openai.provider";
import { ClaudeProvider } from "./providers/claude.provider";

@Injectable()
export class LLMFactory {
  private providers = new Map<string, ILLMProvider>();

  constructor() {
    this.providers.set("openai", new OpenAIProvider());
    this.providers.set("claude", new ClaudeProvider());
  }

  getProvider(name?: string): ILLMProvider {
    const providerName = name || process.env.LLM_PROVIDER || "openai";
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(
        `LLM provider "${providerName}" not found. Available: ${Array.from(this.providers.keys()).join(", ")}`,
      );
    }
    return provider;
  }
}
