import { BadRequestException, Body, Controller, Get, Headers, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MAX_CSV_BYTES, type AnalyticsPipelineDefinition } from "@flowos/analytics-contracts";
import { AnalyticsService, type PipelineSourceBinding, type UploadedCsv } from "./analytics.service";

type CreateProjectBody = { name?: string; description?: string };
type UploadDatasetBody = { datasetName?: string };
type CreatePipelineBody = { name?: string; description?: string; definition?: AnalyticsPipelineDefinition; isApproved?: boolean };
type RunPipelineBody = { sources?: PipelineSourceBinding[]; outputDatasetName?: string };

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("projects")
  listProjects(@Headers("x-workspace-id") workspaceId?: string) {
    return this.analytics.listProjects(this.workspaceId(workspaceId));
  }

  @Post("projects")
  createProject(@Headers("x-workspace-id") workspaceId: string | undefined, @Body() body: CreateProjectBody) {
    return this.analytics.createProject(this.workspaceId(workspaceId), body.name ?? "", body.description);
  }

  @Post("projects/:projectId/datasets")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_CSV_BYTES } }))
  uploadDataset(
    @Headers("x-workspace-id") workspaceId: string | undefined,
    @Param("projectId") projectId: string,
    @UploadedFile() file: UploadedCsv | undefined,
    @Body() body: UploadDatasetBody,
  ) {
    return this.analytics.uploadCsv(this.workspaceId(workspaceId), projectId, body.datasetName ?? "", file);
  }

  @Get("projects/:projectId/dataset-versions")
  listDatasetVersions(@Headers("x-workspace-id") workspaceId: string | undefined, @Param("projectId") projectId: string) {
    return this.analytics.listDatasetVersions(this.workspaceId(workspaceId), projectId);
  }

  @Get("projects/:projectId/pipelines")
  listPipelines(@Headers("x-workspace-id") workspaceId: string | undefined, @Param("projectId") projectId: string) {
    return this.analytics.listPipelineVersions(this.workspaceId(workspaceId), projectId);
  }

  @Post("projects/:projectId/pipelines")
  createPipeline(@Headers("x-workspace-id") workspaceId: string | undefined, @Param("projectId") projectId: string, @Body() body: CreatePipelineBody) {
    if (!body.definition) throw new BadRequestException("Pipeline definition is required.");
    return this.analytics.createPipeline(this.workspaceId(workspaceId), projectId, body.name ?? "", body.description, body.definition, body.isApproved === true);
  }

  @Get("projects/:projectId/pipeline-runs")
  listPipelineRuns(@Headers("x-workspace-id") workspaceId: string | undefined, @Param("projectId") projectId: string) {
    return this.analytics.listPipelineRuns(this.workspaceId(workspaceId), projectId);
  }

  @Get("projects/:projectId/quality-reports")
  listQualityReports(@Headers("x-workspace-id") workspaceId: string | undefined, @Param("projectId") projectId: string) {
    return this.analytics.listQualityReports(this.workspaceId(workspaceId), projectId);
  }

  @Post("projects/:projectId/pipelines/:pipelineVersionId/runs")
  runPipeline(@Headers("x-workspace-id") workspaceId: string | undefined, @Param("projectId") projectId: string, @Param("pipelineVersionId") pipelineVersionId: string, @Body() body: RunPipelineBody) {
    return this.analytics.runPipeline(this.workspaceId(workspaceId), projectId, pipelineVersionId, body.sources ?? [], body.outputDatasetName);
  }

  private workspaceId(value?: string): string {
    return value?.trim() || process.env.DEFAULT_ANALYTICS_WORKSPACE_ID || "default-workspace";
  }
}
