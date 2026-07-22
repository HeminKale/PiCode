import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { ANALYTICS_CONTRACT_VERSION, buildAnalyticsObjectPath, validateAnalyticsResultReference, validateCsvUploadMetadata, validateModelTrainingRequest, validatePipelineDefinition, validatePredictionRequest, type AnalyticsModelFamily, type AnalyticsPipelineDefinition, type AnalyticsPipelineRun, type AnalyticsPipelineVersion, type AnalyticsPredictionSummaryView, type AnalyticsProject, type AnalyticsResultReference, type DatasetVersion, type ModelTrainingRequest, type PredictionContract, type PredictionRequest } from "@flowos/analytics-contracts";
import { AnalyticsMetadataService } from "./analytics-metadata.service";
import { AnalyticsStorageService } from "./analytics-storage.service";
import { AnalyticsWorkerClient } from "./analytics-worker.client";

export type UploadedCsv = { originalname: string; mimetype?: string; size: number; buffer: Buffer };
export type PipelineSourceBinding = { sourceId: string; datasetVersionId: string };
export type PredictionInput = PredictionRequest & { historyDatasetVersionId: string };

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly metadata: AnalyticsMetadataService,
    private readonly storage: AnalyticsStorageService,
    private readonly worker: AnalyticsWorkerClient,
  ) {}

  listProjects(workspaceId: string): Promise<AnalyticsProject[]> {
    return this.metadata.listProjects(workspaceId);
  }

  async createProject(workspaceId: string, name: string, description?: string): Promise<AnalyticsProject> {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 120) throw new BadRequestException("Project name must be between 1 and 120 characters.");
    const project = await this.metadata.createProject(workspaceId, trimmedName, description?.trim());
    await this.metadata.ensureRetentionDefaults(project.id);
    await this.audit(workspaceId, project.id, "project.created", "project", project.id, { name: project.name });
    return project;
  }

  async uploadCsv(workspaceId: string, projectId: string, datasetName: string, file: UploadedCsv | undefined): Promise<DatasetVersion> {
    if (!file) throw new BadRequestException("Attach a CSV file using the file field.");
    const issues = validateCsvUploadMetadata({ fileName: file.originalname, byteSize: file.size, contentType: file.mimetype });
    if (issues.length) throw new BadRequestException({ message: "CSV upload validation failed.", issues });
    const name = datasetName.trim();
    if (!name || name.length > 120) throw new BadRequestException("Dataset name must be between 1 and 120 characters.");

    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    const profile = await this.worker.profileCsv(file.buffer);
    const dataset = await this.metadata.findOrCreateDataset(projectId, name);
    const versionId = randomUUID();
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const path = buildAnalyticsObjectPath(workspaceId, projectId, "raw", versionId, file.originalname);
    const storageRef = { bucket: "analytics-raw", path, artifactKind: "raw" as const, sha256 };
    const metadataVersionId = await this.metadata.createUploadingVersion({ id: versionId, projectId, datasetId: dataset.id, fileName: file.originalname, byteSize: file.size, storage: storageRef });
    try {
      await this.storage.uploadImmutable("raw", path, file.buffer, "text/csv", sha256);
      const version = await this.metadata.markVersionProfiled(metadataVersionId, profile);
      await this.audit(workspaceId, projectId, "dataset.uploaded", "dataset_version", version.id, { datasetId: version.datasetId, byteSize: version.byteSize, rowCount: profile.dataRowCount });
      return version;
    } catch (error) {
      await this.metadata.markVersionFailed(metadataVersionId, error instanceof Error ? error.message : "Storage upload failed.");
      throw error;
    }
  }

  async listDatasetVersions(workspaceId: string, projectId: string): Promise<DatasetVersion[]> {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    return this.metadata.listProfiledDatasetVersions(projectId);
  }

  async createPipeline(workspaceId: string, projectId: string, name: string, description: string | undefined, definition: AnalyticsPipelineDefinition, isApproved: boolean): Promise<AnalyticsPipelineVersion> {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 120) throw new BadRequestException("Pipeline name must be between 1 and 120 characters.");
    const reviewedDefinition: AnalyticsPipelineDefinition = { ...definition, contractVersion: ANALYTICS_CONTRACT_VERSION, projectId, id: definition.id || randomUUID() };
    const issues = validatePipelineDefinition(reviewedDefinition);
    if (issues.length) throw new BadRequestException({ message: "Pipeline validation failed.", issues });
    const template = await this.metadata.findOrCreatePipelineTemplate(projectId, trimmedName, description?.trim());
    const version = await this.metadata.createPipelineVersion(template, reviewedDefinition, isApproved);
    await this.audit(workspaceId, projectId, "pipeline.version_created", "pipeline_version", version.id, { isApproved: version.isApproved, nodeCount: version.definition.nodes.length });
    return version;
  }

  async listPipelineVersions(workspaceId: string, projectId: string): Promise<AnalyticsPipelineVersion[]> {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    return this.metadata.listPipelineVersions(projectId);
  }

  async listPipelineRuns(workspaceId: string, projectId: string): Promise<AnalyticsPipelineRun[]> {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    return this.metadata.listPipelineRuns(projectId);
  }

  async listQualityReports(workspaceId: string, projectId: string) {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    return this.metadata.listQualityReports(projectId);
  }

  async listModelVersions(workspaceId: string, projectId: string) {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    return this.metadata.listModelVersions(projectId);
  }

  async listModelEvaluations(workspaceId: string, projectId: string) {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    return this.metadata.listModelEvaluations(projectId);
  }

  async trainModel(workspaceId: string, projectId: string, request: ModelTrainingRequest) {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    const reviewedRequest: ModelTrainingRequest = {
      ...request,
      contractVersion: ANALYTICS_CONTRACT_VERSION,
      target: "sales_units",
      candidateAlgorithms: request.candidateAlgorithms ?? ["ridge_linear", "poisson_glm", "histogram_gradient_boosting"],
      thresholds: request.thresholds ?? { maxWape: 100 },
    };
    const issues = validateModelTrainingRequest(reviewedRequest);
    if (issues.length) throw new BadRequestException({ message: "Model training validation failed.", issues });
    const trainingVersion = await this.metadata.getProcessedDatasetVersion(projectId, reviewedRequest.trainingDatasetVersionId);
    const modelId = randomUUID();
    const jobId = randomUUID();
    const artifact = { bucket: "analytics-model", path: buildAnalyticsObjectPath(workspaceId, projectId, "model", modelId, "model.json"), artifactKind: "model" as const };
    const pending = await this.metadata.createModelTraining({ projectId, trainingDatasetVersionId: trainingVersion.id, modelFamily: reviewedRequest.candidateAlgorithms[0] as AnalyticsModelFamily, featureSet: { version: "analytics.feature-set.v1", target: "sales_units" }, artifact, jobId, modelId });
    try {
      const result = await this.worker.trainModel({
        contractVersion: ANALYTICS_CONTRACT_VERSION, id: jobId, projectId, type: "TRAIN_MODEL", status: "queued", createdAt: new Date().toISOString(), inputArtifacts: [trainingVersion.storage],
        trainingArtifact: trainingVersion.storage, modelArtifact: { ...artifact, contentType: "application/json" }, trainingRequest: reviewedRequest as unknown as Record<string, unknown>,
      });
      await this.metadata.markModelTrainingSucceeded({ projectId, modelId, jobId, trainingDatasetVersionId: trainingVersion.id, artifact: result.modelArtifact, modelFamily: result.modelFamily, featureSet: result.featureSet, metrics: result.metrics, dataFingerprint: result.dataFingerprint, isApproved: result.isApproved, evaluations: result.evaluations });
      const model = { ...pending, artifact: result.modelArtifact, modelFamily: result.modelFamily, metrics: result.metrics, dataFingerprint: result.dataFingerprint, isApproved: result.isApproved, status: "succeeded" as const };
      await this.audit(workspaceId, projectId, "model.training_completed", "model_version", model.id, { modelFamily: result.modelFamily, isApproved: result.isApproved, wape: result.metrics.wape });
      return model;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Model training worker failed.";
      await this.metadata.markModelTrainingFailed(modelId, jobId, message);
      throw error;
    }
  }

  async listPredictionRuns(workspaceId: string, projectId: string): Promise<PredictionContract[]> {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    return this.metadata.listPredictionRuns(projectId);
  }

  async listAuditEvents(workspaceId: string, projectId: string) {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    return this.metadata.listAuditEvents(projectId);
  }

  async resolvePredictionSummaryReference(workspaceId: string, reference: AnalyticsResultReference): Promise<AnalyticsPredictionSummaryView> {
    const issues = validateAnalyticsResultReference(reference);
    if (issues.length) throw new BadRequestException({ message: "Analytics result reference validation failed.", issues });
    await this.metadata.assertProjectInWorkspace(reference.projectId, workspaceId);
    const prediction = await this.metadata.getPredictionRun(reference.projectId, reference.predictionRunId);
    if (!prediction.summary) throw new BadRequestException("The approved prediction has no safe summary projection.");
    const model = await this.metadata.getModelVersion(reference.projectId, prediction.modelVersionId);
    if (!model.isApproved) throw new BadRequestException("Only predictions from approved models can feed a display.");
    await this.audit(workspaceId, reference.projectId, "prediction.summary_viewed", "prediction_run", prediction.id, { modelVersionId: prediction.modelVersionId, rowCount: prediction.summary.rowCount });
    return { kind: "analytics_prediction_summary", projectId: prediction.projectId, predictionRunId: prediction.id, modelVersionId: prediction.modelVersionId, createdAt: prediction.createdAt, summary: prediction.summary };
  }

  async predict(workspaceId: string, projectId: string, modelVersionId: string, input: PredictionInput): Promise<PredictionContract> {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    const issues = validatePredictionRequest(input);
    if (!input.historyDatasetVersionId || issues.length) throw new BadRequestException({ message: "Prediction validation failed.", issues: input.historyDatasetVersionId ? issues : [{ code: "invalid_prediction", message: "A processed history dataset version is required." }] });
    const model = await this.metadata.getModelVersion(projectId, modelVersionId);
    if (!model.isApproved) throw new BadRequestException("Approve a model version before requesting predictions.");
    const history = await this.metadata.getProcessedDatasetVersion(projectId, input.historyDatasetVersionId);
    const runId = randomUUID();
    const scenarioId = randomUUID();
    const jobId = randomUUID();
    const artifact = { bucket: "analytics-prediction", path: buildAnalyticsObjectPath(workspaceId, projectId, "prediction", runId, "predictions.csv"), artifactKind: "prediction" as const };
    const scenarioSummary = input.mode === "future_forecast" ? { mode: input.mode, rowCount: input.rows.length, horizonWeeks: 4 } : { mode: input.mode, customerId: input.customerId, productCount: input.productIds?.length ?? 0, weekCount: input.weekNums?.length ?? 0 };
    const pending = await this.metadata.createPredictionRun({ projectId, modelVersionId, historyDatasetVersionId: history.id, mode: input.mode, scenarioSummary, predictionArtifact: artifact, jobId, scenarioId, runId });
    try {
      const result = await this.worker.predict({
        contractVersion: ANALYTICS_CONTRACT_VERSION, id: jobId, projectId, type: "PREDICT", status: "queued", createdAt: new Date().toISOString(), inputArtifacts: [model.artifact, history.storage],
        modelArtifact: model.artifact, historyArtifact: history.storage, predictionArtifact: { ...artifact, contentType: "text/csv" }, scenario: input as unknown as Record<string, unknown>,
      });
      await this.metadata.markPredictionSucceeded({ projectId, runId, scenarioId, jobId, historyDatasetVersionId: history.id, artifact: result.predictionArtifact, summary: result.summary });
      const prediction = { ...pending, artifact: result.predictionArtifact, status: "succeeded" as const, summary: result.summary };
      await this.audit(workspaceId, projectId, "prediction.completed", "prediction_run", prediction.id, { modelVersionId, mode: input.mode, rowCount: result.summary.rowCount });
      return prediction;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prediction worker failed.";
      await this.metadata.markPredictionFailed(runId, jobId, message);
      throw error;
    }
  }

  async runPipeline(workspaceId: string, projectId: string, pipelineVersionId: string, sources: PipelineSourceBinding[], outputDatasetName?: string): Promise<AnalyticsPipelineRun> {
    await this.metadata.assertProjectInWorkspace(projectId, workspaceId);
    if (!sources.length || sources.some((source) => !source.sourceId || !source.datasetVersionId) || new Set(sources.map((source) => source.sourceId)).size !== sources.length) {
      throw new BadRequestException("Provide a unique sourceId and profiled dataset version for every CSV input node.");
    }
    const pipelineVersion = await this.metadata.getPipelineVersion(projectId, pipelineVersionId);
    const inputVersions = await this.metadata.getDatasetVersions(projectId, sources.map((source) => source.datasetVersionId));
    if (inputVersions.length !== sources.length) throw new BadRequestException("Every pipeline source must be a profiled raw dataset version in this project.");
    const sourceIds = new Set(pipelineVersion.definition.nodes.filter((node) => node.type === "CSV_INPUT").map((node) => String(node.config.sourceId ?? "")));
    if (sourceIds.size !== sources.length || sources.some((source) => !sourceIds.has(source.sourceId))) {
      throw new BadRequestException("Source bindings must match the pipeline CSV input nodes exactly.");
    }

    const outputVersionId = randomUUID();
    const outputPath = buildAnalyticsObjectPath(workspaceId, projectId, "processed", outputVersionId, "processed.csv");
    const output = { bucket: "analytics-processed", path: outputPath, artifactKind: "processed" as const };
    const outputVersion = await this.metadata.createProcessingVersion({ id: outputVersionId, projectId, datasetName: outputDatasetName?.trim() || "Processed dataset", fileName: "processed.csv", storage: output });
    const workerJobId = randomUUID();
    const run = await this.metadata.createPipelineRun({ projectId, pipelineVersionId, inputDatasetVersionIds: inputVersions.map((version) => version.id), outputDatasetVersionId: outputVersion.id, workerJobId });
    try {
      const result = await this.worker.processDataset({
        contractVersion: ANALYTICS_CONTRACT_VERSION, id: workerJobId, projectId, type: "PROCESS_DATASET", status: "queued", createdAt: new Date().toISOString(),
        inputArtifacts: inputVersions.map((version) => version.storage), pipeline: pipelineVersion.definition as unknown as Record<string, unknown>,
        sources: sources.map((source) => ({ sourceId: source.sourceId, artifact: inputVersions.find((version) => version.id === source.datasetVersionId)!.storage })), outputArtifact: output,
      });
      await this.metadata.markPipelineRunSucceeded({ projectId, runId: run.id, workerJobId, outputVersionId: outputVersion.id, output: result.outputArtifact, outputByteSize: result.outputByteSize, profile: result.outputProfile, report: result.qualityReport, pipelineNodeIds: pipelineVersion.definition.nodes.map((node) => node.id) });
      const completed = { ...run, status: "succeeded" as const };
      await this.audit(workspaceId, projectId, "pipeline.completed", "pipeline_run", completed.id, { pipelineVersionId, outputDatasetVersionId: outputVersion.id, outputRows: result.qualityReport.outputRowCount });
      return completed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pipeline worker failed.";
      await this.metadata.markPipelineRunFailed(run.id, workerJobId, outputVersion.id, message);
      throw error;
    }
  }

  private audit(workspaceId: string, projectId: string, action: string, resourceType: string, resourceId: string, details: Record<string, unknown>): Promise<void> {
    return this.metadata.recordAuditEvent({ workspaceId, projectId, action, resourceType, resourceId, details });
  }
}
