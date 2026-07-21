import { Injectable, BadGatewayException, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Flow } from "@flowos/types";
import { LLMFactory } from "./llm.factory";
import { GENERATE_FLOW_SYSTEM_PROMPT } from "./generate-flow.prompt";

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

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

    const parsed = this.parseGeneratedFlow(content);
    if (!parsed) {
      this.logger.warn(`LLM flow response could not be parsed as JSON (length: ${content.length}).`);
      // This is intentionally opt-in: generated flows can contain business data,
      // so raw model output must never be logged in normal production operation.
      if (process.env.LLM_DEBUG_RESPONSES === "true") {
        this.logger.warn(`LLM flow response preview: ${JSON.stringify(content.slice(0, 2_000))}`);
      }
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
        "Generated with A1 (data) nodes first, B1 (logic) next, D1 (rules) after that, and U1 (UI) nodes last where needed, per the standard FlowOS layer ordering.",
    };
  }

  /**
   * Providers are asked for JSON mode, but a model can still occasionally wrap a
   * response in a Markdown fence. Accept that presentation-only wrapper without
   * accepting arbitrary non-JSON output.
   */
  private parseGeneratedFlow(
    content: string,
  ): { name: string; description: string; nodes: Flow["nodes"]; edges: Flow["edges"] } | null {
    const candidates = new Set([content.trim()]);
    const fencedJson = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fencedJson) candidates.add(fencedJson.trim());

    const objectJson = this.extractFirstJsonObject(content);
    if (objectJson) candidates.add(objectJson);

    for (const candidate of candidates) {
      try {
        const parsed: unknown = JSON.parse(candidate);
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof (parsed as { name?: unknown }).name === "string" &&
          typeof (parsed as { description?: unknown }).description === "string" &&
          Array.isArray((parsed as { nodes?: unknown }).nodes) &&
          Array.isArray((parsed as { edges?: unknown }).edges)
        ) {
          return parsed as { name: string; description: string; nodes: Flow["nodes"]; edges: Flow["edges"] };
        }
      } catch {
        // Try the next strictly delimited JSON candidate.
      }
    }

    return null;
  }

  /** Returns the first complete JSON object, respecting quoted braces. */
  private extractFirstJsonObject(content: string): string | null {
    const start = content.indexOf("{");
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let index = start; index < content.length; index++) {
      const character = content[index];
      if (inString) {
        if (escaping) escaping = false;
        else if (character === "\\") escaping = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') inString = true;
      else if (character === "{") depth++;
      else if (character === "}" && --depth === 0) return content.slice(start, index + 1);
    }

    return null;
  }
}
