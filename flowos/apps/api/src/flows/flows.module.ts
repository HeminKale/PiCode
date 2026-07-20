import { Module } from "@nestjs/common";
import { FlowsController } from "./flows.controller";
import { FlowsService } from "./flows.service";
import { LLMModule } from "../llm/llm.module";

@Module({
  imports: [LLMModule],
  controllers: [FlowsController],
  providers: [FlowsService],
  exports: [FlowsService],
})
export class FlowsModule {}
