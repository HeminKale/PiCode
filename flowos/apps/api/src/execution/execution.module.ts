import { Module } from "@nestjs/common";
import { ExecutionController } from "./execution.controller";
import { ExecutionService } from "./execution.service";
import { SocketModule } from "../socket/socket.module";

@Module({
  imports: [SocketModule],
  controllers: [ExecutionController],
  providers: [ExecutionService],
})
export class ExecutionModule {}
