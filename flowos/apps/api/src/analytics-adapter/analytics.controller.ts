import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MAX_CSV_BYTES, type AnalyticsPipelineDefinition, type AnalyticsResultReference, type ModelTrainingRequest } from "@flowos/analytics-contracts";
import { AnalyticsActorParam } from "./analytics-actor.decorator";
import { AnalyticsAuthGuard } from "./analytics-auth.guard";
import { AnalyticsAuthService, type AnalyticsActor } from "./analytics-auth.service";
import { AnalyticsService, type PipelineSourceBinding, type PredictionInput, type UploadedCsv } from "./analytics.service";

type CreateProjectBody = { name?: string; description?: string };
type UploadDatasetBody = { datasetName?: string };
type CreatePipelineBody = { name?: string; description?: string; definition?: AnalyticsPipelineDefinition; isApproved?: boolean };
type RunPipelineBody = { sources?: PipelineSourceBinding[]; outputDatasetName?: string };
type TrainModelBody = Partial<ModelTrainingRequest>;
type PredictBody = PredictionInput;
type RetentionBody = { artifactKind?: "raw" | "processed" | "model" | "prediction"; retentionDays?: number };

@Controller("analytics")
@UseGuards(AnalyticsAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService, private readonly auth: AnalyticsAuthService) {}

  @Get("projects")
  listProjects(@AnalyticsActorParam() actor: AnalyticsActor) {
    return this.analytics.listProjects(this.auth.requireWorkspacePermission(actor, "projects.view").workspaceId);
  }

  @Post("projects")
  createProject(@AnalyticsActorParam() actor: AnalyticsActor, @Body() body: CreateProjectBody) {
    return this.analytics.createProject(this.auth.requireWorkspacePermission(actor, "projects.create"), body.name ?? "", body.description);
  }

  @Post("projects/:projectId/datasets")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_CSV_BYTES } }))
  async uploadDataset(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string, @UploadedFile() file: UploadedCsv | undefined, @Body() body: UploadDatasetBody) {
    return this.analytics.uploadCsv(await this.auth.requireProjectPermission(actor, projectId, "datasets.upload"), projectId, body.datasetName ?? "", file);
  }

  @Get("projects/:projectId/dataset-versions")
  async listDatasetVersions(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listDatasetVersions(await this.auth.requireProjectPermission(actor, projectId, "projects.view"), projectId); }
  @Get("projects/:projectId/pipelines")
  async listPipelines(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listPipelineVersions(await this.auth.requireProjectPermission(actor, projectId, "projects.view"), projectId); }

  @Post("projects/:projectId/pipelines")
  async createPipeline(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string, @Body() body: CreatePipelineBody) {
    if (!body.definition) throw new BadRequestException("Pipeline definition is required.");
    const projectActor = await this.auth.requireProjectPermission(actor, projectId, body.isApproved ? "pipelines.approve" : "pipelines.edit");
    return this.analytics.createPipeline(projectActor, projectId, body.name ?? "", body.description, body.definition, body.isApproved === true);
  }

  @Get("projects/:projectId/pipeline-runs")
  async listPipelineRuns(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listPipelineRuns(await this.auth.requireProjectPermission(actor, projectId, "operations.view"), projectId); }
  @Get("projects/:projectId/quality-reports")
  async listQualityReports(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listQualityReports(await this.auth.requireProjectPermission(actor, projectId, "projects.view"), projectId); }
  @Get("projects/:projectId/models")
  async listModels(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listModelVersions(await this.auth.requireProjectPermission(actor, projectId, "projects.view"), projectId); }
  @Get("projects/:projectId/model-evaluations")
  async listModelEvaluations(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listModelEvaluations(await this.auth.requireProjectPermission(actor, projectId, "projects.view"), projectId); }

  @Post("projects/:projectId/models")
  async trainModel(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string, @Body() body: TrainModelBody) { return this.analytics.trainModel(await this.auth.requireProjectPermission(actor, projectId, "models.train"), projectId, body as ModelTrainingRequest); }
  @Post("projects/:projectId/models/:modelVersionId/approval")
  async approveModel(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string, @Param("modelVersionId") modelVersionId: string) { return this.analytics.approveModel(await this.auth.requireProjectPermission(actor, projectId, "models.approve"), projectId, modelVersionId); }
  @Get("projects/:projectId/predictions")
  async listPredictions(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listPredictionRuns(await this.auth.requireProjectPermission(actor, projectId, "projects.view"), projectId); }
  @Get("projects/:projectId/audit-events")
  async listAuditEvents(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listAuditEvents(await this.auth.requireProjectPermission(actor, projectId, "audit.view"), projectId); }
  @Get("projects/:projectId/retention")
  async getRetention(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listRetentionPolicies(await this.auth.requireProjectPermission(actor, projectId, "retention.manage"), projectId); }
  @Patch("projects/:projectId/retention")
  async updateRetention(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string, @Body() body: RetentionBody) {
    if (!body.artifactKind || !body.retentionDays) throw new BadRequestException("artifactKind and retentionDays are required.");
    return this.analytics.updateRetentionPolicy(await this.auth.requireProjectPermission(actor, projectId, "retention.manage"), projectId, body.artifactKind, body.retentionDays);
  }
  @Get("projects/:projectId/operations")
  async listOperations(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listOperations(await this.auth.requireProjectPermission(actor, projectId, "operations.view"), projectId); }
  @Get("projects/:projectId/drift-reports")
  async listDriftReports(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string) { return this.analytics.listDriftReports(await this.auth.requireProjectPermission(actor, projectId, "operations.view"), projectId); }

  @Post("result-references/resolve")
  async resolveResultReference(@AnalyticsActorParam() actor: AnalyticsActor, @Body() reference: AnalyticsResultReference) {
    return this.analytics.resolvePredictionSummaryReference(await this.auth.requireProjectPermission(actor, reference.projectId, "projects.view"), reference);
  }
  @Post("projects/:projectId/models/:modelVersionId/predictions")
  async predict(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string, @Param("modelVersionId") modelVersionId: string, @Body() body: PredictBody) { return this.analytics.predict(await this.auth.requireProjectPermission(actor, projectId, "predictions.run"), projectId, modelVersionId, body); }
  @Post("projects/:projectId/pipelines/:pipelineVersionId/runs")
  async runPipeline(@AnalyticsActorParam() actor: AnalyticsActor, @Param("projectId") projectId: string, @Param("pipelineVersionId") pipelineVersionId: string, @Body() body: RunPipelineBody) { return this.analytics.runPipeline(await this.auth.requireProjectPermission(actor, projectId, "pipelines.edit"), projectId, pipelineVersionId, body.sources ?? [], body.outputDatasetName); }
}
