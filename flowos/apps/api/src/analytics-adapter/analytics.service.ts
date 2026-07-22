import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { ANALYTICS_CONTRACT_VERSION, buildAnalyticsObjectPath, validateCsvUploadMetadata, validatePipelineDefinition, type AnalyticsPipelineDefinition, type AnalyticsPipelineRun, type AnalyticsPipelineVersion, type AnalyticsProject, type DatasetVersion } from "@flowos/analytics-contracts";
import { AnalyticsMetadataService } from "./analytics-metadata.service";
import { AnalyticsStorageService } from "./analytics-storage.service";
import { AnalyticsWorkerClient } from "./analytics-worker.client";

export type UploadedCsv = { originalname: string; mimetype?: string; size: number; buffer: Buffer };
export type PipelineSourceBinding = { sourceId: string; datasetVersionId: string };

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

  createProject(workspaceId: string, name: string, description?: string): Promise<AnalyticsProject> {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 120) throw new BadRequestException("Project name must be between 1 and 120 characters.");
    return this.metadata.createProject(workspaceId, trimmedName, description?.trim());
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
      return await this.metadata.markVersionProfiled(metadataVersionId, profile);
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
    return this.metadata.createPipelineVersion(template, reviewedDefinition, isApproved);
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
      return { ...run, status: "succeeded" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pipeline worker failed.";
      await this.metadata.markPipelineRunFailed(run.id, workerJobId, outputVersion.id, message);
      throw error;
    }
  }
}
