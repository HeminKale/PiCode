import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsMetadataService } from "./analytics-metadata.service";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsStorageService } from "./analytics-storage.service";
import { AnalyticsWorkerClient } from "./analytics-worker.client";
import { AnalyticsAuthService } from "./analytics-auth.service";
import { AnalyticsAuthGuard } from "./analytics-auth.guard";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsMetadataService, AnalyticsStorageService, AnalyticsWorkerClient, AnalyticsAuthService, AnalyticsAuthGuard],
})
export class AnalyticsModule {}
