export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  model: string;
}

export interface ILLMProvider {
  name: string;
  generate(request: LLMRequest): Promise<LLMResponse>;
}
