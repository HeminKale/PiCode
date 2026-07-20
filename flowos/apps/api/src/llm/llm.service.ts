import { Injectable, BadGatewayException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Flow } from "@flowos/types";
import { LLMFactory } from "./llm.factory";
import { GENERATE_FLOW_SYSTEM_PROMPT } from "./generate-flow.prompt";

@Injectable()
export class LLMService {
  constructor(private readonly factory: LLMFactory) {}

  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: { maxTokens?: number; temperature?: number; jsonMode?: boolean },
  ): Promise<string> {
    const provider = this.factory.getProvider();
    const response = await provider.generate({
      systemPrompt,
      userPrompt,
      ...options,
    });
    return response.content;
  }

  async generateFlow(
    prompt: string,
    context?: string,
  ): Promise<{ flow: Flow; reasoning: string }> {
    const userPrompt = context ? `${prompt}\n\nContext:\n${context}` : prompt;

    const content = await this.generate(GENERATE_FLOW_SYSTEM_PROMPT, userPrompt, {
      maxTokens: 3000,
      jsonMode: true,
    });

    let parsed: { name: string; description: string; nodes: Flow["nodes"]; edges: Flow["edges"] };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadGatewayException("LLM did not return valid JSON for flow generation");
    }

    const now = new Date().toISOString();
    const flow: Flow = {
      id: randomUUID(),
      name: parsed.name,
      description: parsed.description,
      version: 1,
      createdAt: now,
      updatedAt: now,
      nodes: parsed.nodes,
      edges: parsed.edges,
    };

    return {
      flow,
      reasoning:
        "Generated with A1 (data) nodes first, B1 (logic) in the middle, D1 (rules) last, per the standard FlowOS layer ordering.",
    };
  }
}
