import { Module } from "@nestjs/common";
import { ExecutionController } from "./execution.controller";
import { ExecutionService } from "./execution.service";
import { SocketModule } from "../socket/socket.module";
import { ConnectorsModule } from "../connectors/connectors.module";
import { JavaRuntimeModule } from "../java-runtime/java-runtime.module";
import { LLMModule } from "../llm/llm.module";

@Module({
  imports: [SocketModule, ConnectorsModule, JavaRuntimeModule, LLMModule],
  controllers: [ExecutionController],
  providers: [ExecutionService],
})
export class ExecutionModule {}
