import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsMetadataService } from "./analytics-metadata.service";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsStorageService } from "./analytics-storage.service";
import { AnalyticsWorkerClient } from "./analytics-worker.client";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsMetadataService, AnalyticsStorageService, AnalyticsWorkerClient],
})
export class AnalyticsModule {}
