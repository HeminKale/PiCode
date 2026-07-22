import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LLMModule } from './llm/llm.module';
import { FlowsModule } from './flows/flows.module';
import { SocketModule } from './socket/socket.module';
import { ExecutionModule } from './execution/execution.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { JavaRuntimeModule } from './java-runtime/java-runtime.module';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { AnalyticsModule } from './analytics-adapter/analytics.module';

@Module({
  imports: [PrismaModule, LLMModule, FlowsModule, SocketModule, ConnectorsModule, ExecutionModule, JavaRuntimeModule, ArtifactsModule, AnalyticsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
