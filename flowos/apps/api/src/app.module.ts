import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LLMModule } from './llm/llm.module';
import { FlowsModule } from './flows/flows.module';
import { SocketModule } from './socket/socket.module';
import { ExecutionModule } from './execution/execution.module';

@Module({
  imports: [PrismaModule, LLMModule, FlowsModule, SocketModule, ExecutionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
