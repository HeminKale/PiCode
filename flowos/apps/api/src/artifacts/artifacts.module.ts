import { Module } from "@nestjs/common";
import { ArtifactsController } from "./artifacts.controller";
import { ArtifactsService } from "./artifacts.service";
import { LLMModule } from "../llm/llm.module";
@Module({ imports: [LLMModule], controllers: [ArtifactsController], providers: [ArtifactsService], exports: [ArtifactsService] }) export class ArtifactsModule {}
