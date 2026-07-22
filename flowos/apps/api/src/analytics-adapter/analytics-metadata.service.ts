import { Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AnalyticsModelFamily, AnalyticsPipelineDefinition, AnalyticsPipelineRun, AnalyticsPipelineTemplate, AnalyticsPipelineVersion, AnalyticsPredictionMode, AnalyticsProject, CsvProfile, DataQualityReport, DatasetVersion, ModelEvaluationContract, ModelMetrics, ModelVersionContract, PredictionContract, PredictionOutputSummary, PredictionScenarioContract, StorageObjectRef } from "@flowos/analytics-contracts";

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type DatasetRow = { id: string; project_id: string; name: string };
type DatasetVersionRow = {
  id: string; project_id: string; dataset_id: string; file_name: string; byte_size: number;
  storage_bucket: string; storage_path: string; sha256: string; status: DatasetVersion["status"];
  profile: CsvProfile | null; column_mappings: DatasetVersion["columnMappings"]; created_at: string;
};
type PipelineTemplateRow = { id: string; project_id: string; name: string; description: string | null; created_at: string; updated_at: string };
type PipelineVersionRow = { id: string; pipeline_template_id: string; project_id: string; version: number; definition: AnalyticsPipelineDefinition; is_approved: boolean; created_at: string };
type PipelineRunRow = { id: string; project_id: string; pipeline_version_id: string; status: AnalyticsPipelineRun["status"]; input_dataset_version_ids: string[]; output_dataset_version_id: string | null; worker_job_id: string | null; error_summary: string | null; created_at: string };
type ModelVersionRow = { id: string; project_id: string; training_dataset_version_id: string; model_family: AnalyticsModelFamily; feature_set: { version: string }; artifact: StorageObjectRef; data_fingerprint: string; selected_metrics: ModelMetrics; is_approved: boolean; status: ModelVersionContract["status"]; created_at: string };
type ModelEvaluationRow = { id: string; model_version_id: string; algorithm: AnalyticsModelFamily; metrics: ModelMetrics; segment_errors: Record<string, ModelMetrics>; selected: boolean; created_at: string };
type PredictionScenarioRow = { id: string; project_id: string; model_version_id: string; mode: AnalyticsPredictionMode; horizon_weeks: 4; created_at: string };
type PredictionRunRow = { id: string; project_id: string; scenario_id: string; model_version_id: string; prediction_artifact: StorageObjectRef; status: PredictionContract["status"]; output_summary: PredictionOutputSummary | null; created_at: string };
type AuditEventRow = { id: string; workspace_id: string; project_id: string; action: string; resource_type: string; resource_id: string | null; actor_type: "service" | "system" | "user"; details: Record<string, unknown>; created_at: string };

@Injectable()
export class AnalyticsMetadataService {
  private readonly url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  private readonly serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  private ensureConfigured(): void {
    if (!this.url || !this.serviceRoleKey) {
      throw new ServiceUnavailableException("Analytics metadata is unavailable: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.ensureConfigured();
    const response = await fetch(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.serviceRoleKey!,
        Authorization: `Bearer ${this.serviceRoleKey!}`,
        Prefer: "return=representation",
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new InternalServerErrorException(`Analytics metadata request failed (${response.status}): ${detail}`);
    }
    return response.json() as Promise<T>;
  }

  private toProject(row: ProjectRow): AnalyticsProject {
    return { id: row.id, workspaceId: row.workspace_id, name: row.name, description: row.description, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private toDatasetVersion(row: DatasetVersionRow): DatasetVersion {
    const artifactKind = row.storage_bucket === "analytics-processed" ? "processed" : "raw";
    return {
      id: row.id, projectId: row.project_id, datasetId: row.dataset_id, fileName: row.file_name,
      contentType: "text/csv", byteSize: Number(row.byte_size), status: row.status,
      storage: { bucket: row.storage_bucket, path: row.storage_path, artifactKind, sha256: row.sha256 },
      profile: row.profile ?? undefined, columnMappings: row.column_mappings ?? [], createdAt: row.created_at,
    };
  }

  private toPipelineTemplate(row: PipelineTemplateRow): AnalyticsPipelineTemplate {
    return { id: row.id, projectId: row.project_id, name: row.name, description: row.description, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private toPipelineVersion(row: PipelineVersionRow): AnalyticsPipelineVersion {
    return { id: row.id, templateId: row.pipeline_template_id, projectId: row.project_id, version: row.version, definition: row.definition, isApproved: row.is_approved, createdAt: row.created_at };
  }

  private toPipelineRun(row: PipelineRunRow): AnalyticsPipelineRun {
    return { id: row.id, projectId: row.project_id, pipelineVersionId: row.pipeline_version_id, status: row.status, inputDatasetVersionIds: row.input_dataset_version_ids ?? [], outputDatasetVersionId: row.output_dataset_version_id, workerJobId: row.worker_job_id, errorSummary: row.error_summary, createdAt: row.created_at };
  }

  private toModelVersion(row: ModelVersionRow): ModelVersionContract {
    return { id: row.id, projectId: row.project_id, trainingDatasetVersionId: row.training_dataset_version_id, featureSetVersion: row.feature_set.version, artifact: row.artifact, modelFamily: row.model_family, status: row.status, isApproved: row.is_approved, metrics: row.selected_metrics, dataFingerprint: row.data_fingerprint, createdAt: row.created_at };
  }

  private toModelEvaluation(row: ModelEvaluationRow): ModelEvaluationContract {
    return { id: row.id, modelVersionId: row.model_version_id, algorithm: row.algorithm, metrics: row.metrics, segmentErrors: row.segment_errors ?? {}, selected: row.selected, createdAt: row.created_at };
  }

  private toPredictionScenario(row: PredictionScenarioRow): PredictionScenarioContract {
    return { id: row.id, projectId: row.project_id, modelVersionId: row.model_version_id, mode: row.mode, horizonWeeks: row.horizon_weeks, createdAt: row.created_at };
  }

  private toPredictionRun(row: PredictionRunRow): PredictionContract {
    return { id: row.id, projectId: row.project_id, modelVersionId: row.model_version_id, scenarioId: row.scenario_id, artifact: row.prediction_artifact, status: row.status, summary: row.output_summary ?? undefined, createdAt: row.created_at };
  }

  async listProjects(workspaceId: string): Promise<AnalyticsProject[]> {
    const query = new URLSearchParams({ select: "id,workspace_id,name,description,created_at,updated_at", workspace_id: `eq.${workspaceId}`, order: "updated_at.desc" });
    const rows = await this.request<ProjectRow[]>(`analytics_projects?${query}`);
    return rows.map((row) => this.toProject(row));
  }

  async recordAuditEvent(input: { workspaceId: string; projectId: string; action: string; resourceType: string; resourceId?: string; details?: Record<string, unknown> }): Promise<void> {
    await this.request("analytics_audit_events", {
      method: "POST",
      body: JSON.stringify({ id: randomUUID(), workspace_id: input.workspaceId, project_id: input.projectId, action: input.action, resource_type: input.resourceType, resource_id: input.resourceId ?? null, actor_type: "service", details: input.details ?? {} }),
    });
  }

  async ensureRetentionDefaults(projectId: string): Promise<void> {
    const policies = [["raw", 365], ["processed", 365], ["model", 730], ["prediction", 365]];
    await this.request("analytics_retention_policies", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(policies.map(([artifactKind, retentionDays]) => ({ id: randomUUID(), project_id: projectId, artifact_kind: artifactKind, retention_days: retentionDays }))),
    });
    await this.request("analytics_cleanup_schedules", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: randomUUID(), project_id: projectId, schedule_cron: "0 3 * * *", is_enabled: true }),
    });
  }

  async listAuditEvents(projectId: string): Promise<Array<{ id: string; action: string; resourceType: string; resourceId?: string; details: Record<string, unknown>; createdAt: string }>> {
    const query = new URLSearchParams({ select: "id,workspace_id,project_id,action,resource_type,resource_id,actor_type,details,created_at", project_id: `eq.${projectId}`, order: "created_at.desc", limit: "50" });
    const rows = await this.request<AuditEventRow[]>(`analytics_audit_events?${query}`);
    return rows.map((row) => ({ id: row.id, action: row.action, resourceType: row.resource_type, resourceId: row.resource_id ?? undefined, details: row.details ?? {}, createdAt: row.created_at }));
  }

  async createProject(workspaceId: string, name: string, description?: string): Promise<AnalyticsProject> {
    const [row] = await this.request<ProjectRow[]>("analytics_projects", {
      method: "POST",
      body: JSON.stringify({ id: randomUUID(), workspace_id: workspaceId, name, description: description || null }),
    });
    if (!row) throw new InternalServerErrorException("Analytics project was not created.");
    return this.toProject(row);
  }

  async assertProjectInWorkspace(projectId: string, workspaceId: string): Promise<void> {
    const query = new URLSearchParams({ select: "id", id: `eq.${projectId}`, workspace_id: `eq.${workspaceId}`, limit: "1" });
    const rows = await this.request<Array<{ id: string }>>(`analytics_projects?${query}`);
    if (!rows[0]) throw new NotFoundException("Analytics project was not found in this workspace.");
  }

  async findOrCreateDataset(projectId: string, name: string): Promise<DatasetRow> {
    const query = new URLSearchParams({ select: "id,project_id,name", project_id: `eq.${projectId}`, name: `eq.${name}`, limit: "1" });
    const existing = await this.request<DatasetRow[]>(`analytics_datasets?${query}`);
    if (existing[0]) return existing[0];
    const [created] = await this.request<DatasetRow[]>("analytics_datasets", {
      method: "POST",
      body: JSON.stringify({ id: randomUUID(), project_id: projectId, name }),
    });
    if (!created) throw new InternalServerErrorException("Analytics dataset was not created.");
    return created;
  }

  async createUploadingVersion(input: { id: string; projectId: string; datasetId: string; fileName: string; byteSize: number; storage: StorageObjectRef }): Promise<string> {
    const id = input.id;
    await this.request("analytics_dataset_versions", {
      method: "POST",
      body: JSON.stringify({
        id,
        project_id: input.projectId,
        dataset_id: input.datasetId,
        file_name: input.fileName,
        content_type: "text/csv",
        byte_size: input.byteSize,
        storage_bucket: input.storage.bucket,
        storage_path: input.storage.path,
        sha256: input.storage.sha256,
        status: "uploading",
        column_mappings: [],
      }),
    });
    return id;
  }

  async markVersionProfiled(versionId: string, profile: CsvProfile): Promise<DatasetVersion> {
    const [row] = await this.request<Array<Record<string, unknown>>>(`analytics_dataset_versions?id=eq.${versionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "profiled", profile }),
    });
    if (!row) throw new InternalServerErrorException("Analytics dataset version was not updated.");
    return {
      id: String(row.id), projectId: String(row.project_id), datasetId: String(row.dataset_id), fileName: String(row.file_name),
      contentType: "text/csv", byteSize: Number(row.byte_size), status: "profiled",
      storage: { bucket: String(row.storage_bucket), path: String(row.storage_path), artifactKind: "raw", sha256: String(row.sha256) },
      profile, columnMappings: [], createdAt: String(row.created_at),
    };
  }

  async markVersionFailed(versionId: string, error: string): Promise<void> {
    await this.request(`analytics_dataset_versions?id=eq.${versionId}`, { method: "PATCH", body: JSON.stringify({ status: "failed", failure_reason: error.slice(0, 1000) }) });
  }

  async listProfiledDatasetVersions(projectId: string): Promise<DatasetVersion[]> {
    const query = new URLSearchParams({ select: "id,project_id,dataset_id,file_name,byte_size,storage_bucket,storage_path,sha256,status,profile,column_mappings,created_at", project_id: `eq.${projectId}`, status: "in.(profiled,processed)", order: "created_at.desc" });
    const rows = await this.request<DatasetVersionRow[]>(`analytics_dataset_versions?${query}`);
    return rows.map((row) => this.toDatasetVersion(row));
  }

  async getDatasetVersions(projectId: string, ids: string[]): Promise<DatasetVersion[]> {
    if (!ids.length) return [];
    const query = new URLSearchParams({ select: "id,project_id,dataset_id,file_name,byte_size,storage_bucket,storage_path,sha256,status,profile,column_mappings,created_at", project_id: `eq.${projectId}`, id: `in.(${ids.join(",")})`, status: "eq.profiled" });
    const rows = await this.request<DatasetVersionRow[]>(`analytics_dataset_versions?${query}`);
    return rows.map((row) => this.toDatasetVersion(row));
  }

  async findOrCreatePipelineTemplate(projectId: string, name: string, description?: string): Promise<AnalyticsPipelineTemplate> {
    const query = new URLSearchParams({ select: "id,project_id,name,description,created_at,updated_at", project_id: `eq.${projectId}`, name: `eq.${name}`, limit: "1" });
    const existing = await this.request<PipelineTemplateRow[]>(`analytics_pipeline_templates?${query}`);
    if (existing[0]) return this.toPipelineTemplate(existing[0]);
    const [created] = await this.request<PipelineTemplateRow[]>("analytics_pipeline_templates", { method: "POST", body: JSON.stringify({ id: randomUUID(), project_id: projectId, name, description: description || null }) });
    if (!created) throw new InternalServerErrorException("Analytics pipeline template was not created.");
    return this.toPipelineTemplate(created);
  }

  async createPipelineVersion(template: AnalyticsPipelineTemplate, definition: AnalyticsPipelineDefinition, isApproved: boolean): Promise<AnalyticsPipelineVersion> {
    const query = new URLSearchParams({ select: "version", pipeline_template_id: `eq.${template.id}`, order: "version.desc", limit: "1" });
    const current = await this.request<Array<{ version: number }>>(`analytics_pipeline_versions?${query}`);
    const version = (current[0]?.version ?? 0) + 1;
    const persistedDefinition = { ...definition, version };
    const [created] = await this.request<PipelineVersionRow[]>("analytics_pipeline_versions", { method: "POST", body: JSON.stringify({ id: randomUUID(), pipeline_template_id: template.id, project_id: template.projectId, version, contract_version: "analytics.v1", definition: persistedDefinition, is_approved: isApproved }) });
    if (!created) throw new InternalServerErrorException("Analytics pipeline version was not created.");
    return this.toPipelineVersion(created);
  }

  async listPipelineVersions(projectId: string): Promise<AnalyticsPipelineVersion[]> {
    const query = new URLSearchParams({ select: "id,pipeline_template_id,project_id,version,definition,is_approved,created_at", project_id: `eq.${projectId}`, order: "created_at.desc" });
    const rows = await this.request<PipelineVersionRow[]>(`analytics_pipeline_versions?${query}`);
    return rows.map((row) => this.toPipelineVersion(row));
  }

  async getPipelineVersion(projectId: string, id: string): Promise<AnalyticsPipelineVersion> {
    const query = new URLSearchParams({ select: "id,pipeline_template_id,project_id,version,definition,is_approved,created_at", project_id: `eq.${projectId}`, id: `eq.${id}`, limit: "1" });
    const rows = await this.request<PipelineVersionRow[]>(`analytics_pipeline_versions?${query}`);
    if (!rows[0]) throw new NotFoundException("Analytics pipeline version was not found in this project.");
    return this.toPipelineVersion(rows[0]);
  }

  async createProcessingVersion(input: { id: string; projectId: string; datasetName: string; fileName: string; storage: StorageObjectRef }): Promise<DatasetVersion> {
    const dataset = await this.findOrCreateDataset(input.projectId, input.datasetName);
    const [row] = await this.request<DatasetVersionRow[]>("analytics_dataset_versions", { method: "POST", body: JSON.stringify({ id: input.id, project_id: input.projectId, dataset_id: dataset.id, file_name: input.fileName, content_type: "text/csv", byte_size: 1, storage_bucket: input.storage.bucket, storage_path: input.storage.path, sha256: input.storage.sha256 ?? "0".repeat(64), status: "processing", column_mappings: [] }) });
    if (!row) throw new InternalServerErrorException("Processed dataset version was not created.");
    return this.toDatasetVersion(row);
  }

  async createPipelineRun(input: { projectId: string; pipelineVersionId: string; inputDatasetVersionIds: string[]; outputDatasetVersionId: string; workerJobId: string }): Promise<AnalyticsPipelineRun> {
    await this.request("analytics_jobs", { method: "POST", body: JSON.stringify({ id: input.workerJobId, project_id: input.projectId, contract_version: "analytics.v1", job_type: "PROCESS_DATASET", status: "running", input_artifacts: [], output_artifacts: [], started_at: new Date().toISOString() }) });
    const [row] = await this.request<PipelineRunRow[]>("analytics_pipeline_runs", { method: "POST", body: JSON.stringify({ id: randomUUID(), project_id: input.projectId, pipeline_version_id: input.pipelineVersionId, status: "running", input_dataset_version_ids: input.inputDatasetVersionIds, output_dataset_version_id: input.outputDatasetVersionId, worker_job_id: input.workerJobId, started_at: new Date().toISOString() }) });
    if (!row) throw new InternalServerErrorException("Analytics pipeline run was not created.");
    return this.toPipelineRun(row);
  }

  async markPipelineRunSucceeded(input: { projectId: string; runId: string; workerJobId: string; outputVersionId: string; output: StorageObjectRef; outputByteSize: number; profile: CsvProfile; report: DataQualityReport; pipelineNodeIds: string[] }): Promise<void> {
    const now = new Date().toISOString();
    await this.request(`analytics_dataset_versions?id=eq.${input.outputVersionId}`, { method: "PATCH", body: JSON.stringify({ status: "processed", storage_bucket: input.output.bucket, storage_path: input.output.path, sha256: input.output.sha256, byte_size: input.outputByteSize, profile: input.profile }) });
    await this.request(`analytics_jobs?id=eq.${input.workerJobId}`, { method: "PATCH", body: JSON.stringify({ status: "succeeded", output_artifacts: [input.output], completed_at: now }) });
    await this.request(`analytics_pipeline_runs?id=eq.${input.runId}`, { method: "PATCH", body: JSON.stringify({ status: "succeeded", completed_at: now }) });
    await this.request("analytics_quality_reports", { method: "POST", body: JSON.stringify({ id: randomUUID(), project_id: input.projectId, pipeline_run_id: input.runId, report: input.report }) });
    await Promise.all(input.pipelineNodeIds.map((nodeId) => this.request("analytics_pipeline_node_lineage", { method: "POST", body: JSON.stringify({ id: randomUUID(), pipeline_run_id: input.runId, node_id: nodeId, status: "succeeded", input_refs: [], output_refs: [] }) })));
  }

  async markPipelineRunFailed(runId: string, workerJobId: string, outputVersionId: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    await Promise.all([
      this.markVersionFailed(outputVersionId, error),
      this.request(`analytics_jobs?id=eq.${workerJobId}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error_summary: error.slice(0, 1000), completed_at: now }) }),
      this.request(`analytics_pipeline_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error_summary: error.slice(0, 1000), completed_at: now }) }),
    ]);
  }

  async getProcessedDatasetVersion(projectId: string, id: string): Promise<DatasetVersion> {
    const query = new URLSearchParams({ select: "id,project_id,dataset_id,file_name,byte_size,storage_bucket,storage_path,sha256,status,profile,column_mappings,created_at", project_id: `eq.${projectId}`, id: `eq.${id}`, status: "eq.processed", limit: "1" });
    const rows = await this.request<DatasetVersionRow[]>(`analytics_dataset_versions?${query}`);
    if (!rows[0]) throw new NotFoundException("A processed dataset version was not found in this project.");
    return this.toDatasetVersion(rows[0]);
  }

  async createModelTraining(input: { projectId: string; trainingDatasetVersionId: string; modelFamily: AnalyticsModelFamily; featureSet: Record<string, unknown>; artifact: StorageObjectRef; jobId: string; modelId: string }): Promise<ModelVersionContract> {
    await this.request("analytics_jobs", { method: "POST", body: JSON.stringify({ id: input.jobId, project_id: input.projectId, contract_version: "analytics.v1", job_type: "TRAIN_MODEL", status: "running", input_artifacts: [], output_artifacts: [], started_at: new Date().toISOString() }) });
    const [row] = await this.request<ModelVersionRow[]>("analytics_model_versions", { method: "POST", body: JSON.stringify({ id: input.modelId, project_id: input.projectId, training_dataset_version_id: input.trainingDatasetVersionId, job_id: input.jobId, contract_version: "analytics.v1", model_family: input.modelFamily, feature_set: input.featureSet, artifact: input.artifact, data_fingerprint: "0".repeat(64), selected_metrics: { wape: 0, mae: 0, rmse: 0, r2: 0, bias: 0 }, is_approved: false, status: "running" }) });
    if (!row) throw new InternalServerErrorException("Analytics model version was not created.");
    return this.toModelVersion(row);
  }

  async markModelTrainingSucceeded(input: { projectId: string; modelId: string; jobId: string; trainingDatasetVersionId: string; artifact: StorageObjectRef; modelFamily: AnalyticsModelFamily; featureSet: Record<string, unknown>; metrics: ModelMetrics; dataFingerprint: string; isApproved: boolean; evaluations: Array<{ algorithm: AnalyticsModelFamily; metrics: ModelMetrics; segmentErrors: Record<string, ModelMetrics>; selected: boolean }> }): Promise<void> {
    const now = new Date().toISOString();
    await this.request(`analytics_model_versions?id=eq.${input.modelId}`, { method: "PATCH", body: JSON.stringify({ artifact: input.artifact, model_family: input.modelFamily, feature_set: input.featureSet, selected_metrics: input.metrics, data_fingerprint: input.dataFingerprint, is_approved: input.isApproved, status: "succeeded", completed_at: now }) });
    await this.request(`analytics_jobs?id=eq.${input.jobId}`, { method: "PATCH", body: JSON.stringify({ status: "succeeded", output_artifacts: [input.artifact], completed_at: now }) });
    await this.request("analytics_lineage", { method: "POST", body: JSON.stringify({ id: randomUUID(), project_id: input.projectId, relationship: "trained_from", input_dataset_version_id: input.trainingDatasetVersionId, job_id: input.jobId, metadata: { modelVersionId: input.modelId } }) });
    await Promise.all(input.evaluations.map((evaluation) => this.request("analytics_model_evaluations", { method: "POST", body: JSON.stringify({ id: randomUUID(), model_version_id: input.modelId, algorithm: evaluation.algorithm, metrics: evaluation.metrics, segment_errors: evaluation.segmentErrors, selected: evaluation.selected }) })));
  }

  async markModelTrainingFailed(modelId: string, jobId: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    await Promise.all([
      this.request(`analytics_model_versions?id=eq.${modelId}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error_summary: error.slice(0, 1000), completed_at: now }) }),
      this.request(`analytics_jobs?id=eq.${jobId}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error_summary: error.slice(0, 1000), completed_at: now }) }),
    ]);
  }

  async listModelVersions(projectId: string): Promise<ModelVersionContract[]> {
    const query = new URLSearchParams({ select: "id,project_id,training_dataset_version_id,model_family,feature_set,artifact,data_fingerprint,selected_metrics,is_approved,status,created_at", project_id: `eq.${projectId}`, order: "created_at.desc" });
    const rows = await this.request<ModelVersionRow[]>(`analytics_model_versions?${query}`);
    return rows.map((row) => this.toModelVersion(row));
  }

  async getModelVersion(projectId: string, id: string): Promise<ModelVersionContract> {
    const query = new URLSearchParams({ select: "id,project_id,training_dataset_version_id,model_family,feature_set,artifact,data_fingerprint,selected_metrics,is_approved,status,created_at", project_id: `eq.${projectId}`, id: `eq.${id}`, status: "eq.succeeded", limit: "1" });
    const rows = await this.request<ModelVersionRow[]>(`analytics_model_versions?${query}`);
    if (!rows[0]) throw new NotFoundException("A completed model version was not found in this project.");
    return this.toModelVersion(rows[0]);
  }

  async listModelEvaluations(projectId: string): Promise<ModelEvaluationContract[]> {
    const query = new URLSearchParams({ select: "id,model_version_id,algorithm,metrics,segment_errors,selected,created_at,analytics_model_versions!inner(project_id)", "analytics_model_versions.project_id": `eq.${projectId}`, order: "created_at.desc" });
    const rows = await this.request<ModelEvaluationRow[]>(`analytics_model_evaluations?${query}`);
    return rows.map((row) => this.toModelEvaluation(row));
  }

  async createPredictionRun(input: { projectId: string; modelVersionId: string; historyDatasetVersionId: string; mode: AnalyticsPredictionMode; scenarioSummary: Record<string, unknown>; predictionArtifact: StorageObjectRef; jobId: string; scenarioId: string; runId: string }): Promise<PredictionContract> {
    await this.request("analytics_jobs", { method: "POST", body: JSON.stringify({ id: input.jobId, project_id: input.projectId, contract_version: "analytics.v1", job_type: "PREDICT", status: "running", input_artifacts: [], output_artifacts: [], started_at: new Date().toISOString() }) });
    await this.request("analytics_prediction_scenarios", { method: "POST", body: JSON.stringify({ id: input.scenarioId, project_id: input.projectId, model_version_id: input.modelVersionId, mode: input.mode, horizon_weeks: 4, scenario_summary: input.scenarioSummary }) });
    const [row] = await this.request<PredictionRunRow[]>("analytics_prediction_runs", { method: "POST", body: JSON.stringify({ id: input.runId, project_id: input.projectId, scenario_id: input.scenarioId, model_version_id: input.modelVersionId, history_dataset_version_id: input.historyDatasetVersionId, job_id: input.jobId, prediction_artifact: input.predictionArtifact, status: "running" }) });
    if (!row) throw new InternalServerErrorException("Analytics prediction run was not created.");
    return this.toPredictionRun(row);
  }

  async markPredictionSucceeded(input: { projectId: string; runId: string; scenarioId: string; jobId: string; historyDatasetVersionId: string; artifact: StorageObjectRef; summary: PredictionOutputSummary }): Promise<void> {
    const now = new Date().toISOString();
    await this.request(`analytics_prediction_runs?id=eq.${input.runId}`, { method: "PATCH", body: JSON.stringify({ status: "succeeded", prediction_artifact: input.artifact, output_summary: input.summary, completed_at: now }) });
    await this.request(`analytics_jobs?id=eq.${input.jobId}`, { method: "PATCH", body: JSON.stringify({ status: "succeeded", output_artifacts: [input.artifact], completed_at: now }) });
    await this.request("analytics_lineage", { method: "POST", body: JSON.stringify({ id: randomUUID(), project_id: input.projectId, relationship: "predicted_from", input_dataset_version_id: input.historyDatasetVersionId, job_id: input.jobId, metadata: { scenarioId: input.scenarioId } }) });
  }

  async markPredictionFailed(runId: string, jobId: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    await Promise.all([
      this.request(`analytics_prediction_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error_summary: error.slice(0, 1000), completed_at: now }) }),
      this.request(`analytics_jobs?id=eq.${jobId}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error_summary: error.slice(0, 1000), completed_at: now }) }),
    ]);
  }

  async listPredictionRuns(projectId: string): Promise<PredictionContract[]> {
    const query = new URLSearchParams({ select: "id,project_id,scenario_id,model_version_id,prediction_artifact,status,output_summary,created_at", project_id: `eq.${projectId}`, order: "created_at.desc" });
    const rows = await this.request<PredictionRunRow[]>(`analytics_prediction_runs?${query}`);
    return rows.map((row) => this.toPredictionRun(row));
  }

  async getPredictionRun(projectId: string, id: string): Promise<PredictionContract> {
    const query = new URLSearchParams({ select: "id,project_id,scenario_id,model_version_id,prediction_artifact,status,output_summary,created_at", project_id: `eq.${projectId}`, id: `eq.${id}`, status: "eq.succeeded", limit: "1" });
    const rows = await this.request<PredictionRunRow[]>(`analytics_prediction_runs?${query}`);
    if (!rows[0]) throw new NotFoundException("A completed prediction result was not found in this project.");
    return this.toPredictionRun(rows[0]);
  }

  async listPipelineRuns(projectId: string): Promise<AnalyticsPipelineRun[]> {
    const query = new URLSearchParams({ select: "id,project_id,pipeline_version_id,status,input_dataset_version_ids,output_dataset_version_id,worker_job_id,error_summary,created_at", project_id: `eq.${projectId}`, order: "created_at.desc" });
    const rows = await this.request<PipelineRunRow[]>(`analytics_pipeline_runs?${query}`);
    return rows.map((row) => this.toPipelineRun(row));
  }

  async listQualityReports(projectId: string): Promise<Array<{ pipelineRunId: string; report: DataQualityReport; createdAt: string }>> {
    const query = new URLSearchParams({ select: "pipeline_run_id,report,created_at", project_id: `eq.${projectId}`, order: "created_at.desc" });
    const rows = await this.request<Array<{ pipeline_run_id: string; report: DataQualityReport; created_at: string }>>(`analytics_quality_reports?${query}`);
    return rows.map((row) => ({ pipelineRunId: row.pipeline_run_id, report: row.report, createdAt: row.created_at }));
  }
}
