import { Module } from "@nestjs/common";
import { LLMFactory } from "./llm.factory";
import { LLMService } from "./llm.service";

@Module({
  providers: [LLMFactory, LLMService],
  exports: [LLMService],
})
export class LLMModule {}
