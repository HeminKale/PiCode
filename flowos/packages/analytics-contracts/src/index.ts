export const ANALYTICS_CONTRACT_VERSION = "analytics.v1" as const;
export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_DATA_ROWS = 15_000;

export type AnalyticsArtifactKind = "raw" | "processed" | "model" | "prediction";
export type DatasetVersionStatus = "uploading" | "profiled" | "processing" | "processed" | "failed";
export type AnalyticsJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type AnalyticsJobType = "PROFILE_DATASET" | "PROCESS_DATASET" | "TRAIN_MODEL" | "PREDICT";
export type AnalyticsModelFamily = "ridge_linear" | "poisson_glm" | "histogram_gradient_boosting";
export type AnalyticsPredictionMode = "historical_what_if" | "future_forecast";

export interface AnalyticsProject {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorageObjectRef {
  bucket: string;
  path: string;
  artifactKind: AnalyticsArtifactKind;
  sha256?: string;
}

export interface CsvColumnProfile {
  name: string;
  inferredType: "string" | "number" | "boolean" | "date" | "unknown";
  nullCount: number;
}

export interface CsvProfile {
  encoding: "utf-8" | "utf-8-sig";
  delimiter: string;
  hasHeader: boolean;
  dataRowCount: number;
  columns: CsvColumnProfile[];
  warnings: string[];
}

export interface ColumnMapping {
  sourceColumn: string;
  canonicalColumn: CanonicalAnalyticsColumn;
  transformation?: "none" | "normalize_0_1";
}

export type CanonicalAnalyticsColumn =
  | "product_id" | "customer_id" | "week_num" | "week_start" | "week_end"
  | "num_stores" | "consumer_price" | "promotion_intensity" | "sales_units"
  | "sales_dollars" | "baseline_units" | `tactic_${string}_intensity`;

export type AnalyticsPipelineNodeType =
  | "CSV_INPUT" | "SCHEMA_VALIDATE" | "CAST_COLUMNS" | "SELECT_COLUMNS"
  | "RENAME_COLUMNS" | "FILTER_ROWS" | "DERIVE_COLUMN" | "DROP_COLUMNS"
  | "HANDLE_MISSING" | "DEDUPLICATE" | "APPEND" | "JOIN" | "AGGREGATE"
  | "SORT" | "OUTPUT_DATASET";

export interface AnalyticsPipelineNode {
  id: string;
  type: AnalyticsPipelineNodeType;
  inputIds: string[];
  config: Record<string, unknown>;
}

export interface AnalyticsPipelineDefinition {
  contractVersion: typeof ANALYTICS_CONTRACT_VERSION;
  id: string;
  projectId: string;
  version: number;
  nodes: AnalyticsPipelineNode[];
  columnMappings: ColumnMapping[];
}

export interface AnalyticsPipelineTemplate {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsPipelineVersion {
  id: string;
  templateId: string;
  projectId: string;
  version: number;
  definition: AnalyticsPipelineDefinition;
  isApproved: boolean;
  createdAt: string;
}

export interface AnalyticsPipelineRun {
  id: string;
  projectId: string;
  pipelineVersionId: string;
  status: AnalyticsJobStatus;
  inputDatasetVersionIds: string[];
  outputDatasetVersionId?: string | null;
  workerJobId?: string | null;
  errorSummary?: string | null;
  createdAt: string;
}

export interface DataQualityFinding {
  code: "null_rate" | "duplicate_grain" | "invalid_week" | "negative_units" | "invalid_promotion_intensity" | "missing_calendar_match" | "outlier" | "schema";
  severity: "info" | "warning" | "error";
  column?: string;
  count?: number;
  message: string;
}

export interface DataQualityReport {
  inputRowCount: number;
  outputRowCount: number;
  findings: DataQualityFinding[];
}

export interface ProcessedDatasetResult {
  output: StorageObjectRef;
  qualityReport: DataQualityReport;
  lineageInputDatasetVersionIds: string[];
}

export interface DatasetVersion {
  id: string;
  projectId: string;
  datasetId: string;
  fileName: string;
  contentType: "text/csv";
  byteSize: number;
  status: DatasetVersionStatus;
  storage: StorageObjectRef;
  profile?: CsvProfile;
  columnMappings: ColumnMapping[];
  createdAt: string;
}

export interface AnalyticsLineage {
  id: string;
  projectId: string;
  relationship: "derived_from" | "trained_from" | "predicted_from";
  inputDatasetVersionId?: string;
  outputDatasetVersionId?: string;
  jobId?: string;
}

export interface FeatureSetContract {
  version: string;
  target: "sales_units";
  excludedByDefault: string[];
  canonicalColumns: string[];
  tacticFields: Array<{ intensity: string; reportedIndicator: string }>;
}

export interface ModelVersionContract {
  id: string;
  projectId: string;
  trainingDatasetVersionId: string;
  featureSetVersion: string;
  artifact: StorageObjectRef;
  modelFamily: AnalyticsModelFamily;
  status: AnalyticsJobStatus;
  isApproved: boolean;
  metrics: ModelMetrics;
  dataFingerprint: string;
  createdAt: string;
}

export interface ModelMetrics {
  wape: number;
  mae: number;
  rmse: number;
  r2: number;
  bias: number;
}

export interface ModelEvaluationContract {
  id: string;
  modelVersionId: string;
  algorithm: AnalyticsModelFamily;
  metrics: ModelMetrics;
  segmentErrors: Record<string, ModelMetrics>;
  selected: boolean;
  createdAt: string;
}

export interface TrainingThresholds {
  maxWape?: number;
}

export interface ModelTrainingRequest {
  contractVersion: typeof ANALYTICS_CONTRACT_VERSION;
  trainingDatasetVersionId: string;
  target: "sales_units";
  candidateAlgorithms: AnalyticsModelFamily[];
  includeBaselineUnits?: boolean;
  validationWeeks?: number;
  thresholds?: TrainingThresholds;
}

export interface ForecastRowInput {
  productId: string;
  customerId: string;
  weekNum: string;
  consumerPrice: number;
  numStores: number;
  promotionIntensity: number;
  tactics?: Record<string, number | null | undefined>;
}

export interface HistoricalWhatIfInput {
  mode: "historical_what_if";
  customerId: string;
  productIds?: string[];
  weekNums?: string[];
  promotionIntensity: number;
  tactics?: Record<string, number | null | undefined>;
}

export interface FutureForecastInput {
  mode: "future_forecast";
  rows: ForecastRowInput[];
}

export type PredictionRequest = HistoricalWhatIfInput | FutureForecastInput;

export interface PredictionScenarioContract {
  id: string;
  projectId: string;
  modelVersionId: string;
  mode: AnalyticsPredictionMode;
  horizonWeeks: 4;
  createdAt: string;
}

export interface PredictionOutputSummary {
  rowCount: number;
  totalBaselineUnits: number;
  totalPromotedUnits: number;
  totalIncrementalUnits: number;
  weightedPercentIncrement: number;
  qualityFlags: string[];
}

export interface PredictionContract {
  id: string;
  projectId: string;
  modelVersionId: string;
  scenarioId: string;
  artifact: StorageObjectRef;
  status: AnalyticsJobStatus;
  summary?: PredictionOutputSummary;
  createdAt: string;
}

export interface AnalyticsJob {
  contractVersion: typeof ANALYTICS_CONTRACT_VERSION;
  id: string;
  projectId: string;
  type: AnalyticsJobType;
  status: AnalyticsJobStatus;
  inputArtifacts: StorageObjectRef[];
  createdAt: string;
}

export interface AnalyticsJobEvent {
  contractVersion: typeof ANALYTICS_CONTRACT_VERSION;
  eventType: "job.accepted" | "job.started" | "job.succeeded" | "job.failed";
  jobId: string;
  status: AnalyticsJobStatus;
  occurredAt: string;
}

export interface CsvUploadMetadata {
  fileName: string;
  byteSize: number;
  contentType?: string;
}

export interface ValidationIssue {
  code: "invalid_file_type" | "file_too_large" | "invalid_file_name" | "invalid_column_mapping" | "invalid_pipeline" | "invalid_model_training" | "invalid_prediction";
  message: string;
}

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function validateCsvUploadMetadata(input: CsvUploadMetadata): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.fileName.toLowerCase().endsWith(".csv")) {
    issues.push({ code: "invalid_file_type", message: "Only .csv files are accepted." });
  }
  if (input.contentType && !["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"].includes(input.contentType)) {
    issues.push({ code: "invalid_file_type", message: "The uploaded file must have a CSV content type." });
  }
  if (input.byteSize > MAX_CSV_BYTES) {
    issues.push({ code: "file_too_large", message: "CSV versions are limited to 10 MB." });
  }
  if (input.fileName.includes("/") || input.fileName.includes("\\") || input.fileName.includes("..")) {
    issues.push({ code: "invalid_file_name", message: "The CSV filename is not safe." });
  }
  return issues;
}

export function analyticsBucketFor(kind: AnalyticsArtifactKind): string {
  return `analytics-${kind}`;
}

export function buildAnalyticsObjectPath(
  workspaceId: string,
  projectId: string,
  kind: AnalyticsArtifactKind,
  objectId: string,
  fileName: string,
): string {
  for (const [label, value] of Object.entries({ workspaceId, projectId, objectId })) {
    if (!SAFE_SEGMENT.test(value)) throw new Error(`${label} is not a safe analytics storage segment`);
  }
  const normalizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!normalizedFileName || normalizedFileName === "." || normalizedFileName === "..") {
    throw new Error("fileName is not safe for analytics storage");
  }
  return `${workspaceId}/projects/${projectId}/${kind}/${objectId}/${normalizedFileName}`;
}

export function defaultFeatureSet(): FeatureSetContract {
  return {
    version: "analytics.feature-set.v1",
    target: "sales_units",
    excludedByDefault: ["baseline_units", "sales_dollars"],
    canonicalColumns: ["product_id", "customer_id", "week_num", "promotion_intensity"],
    tacticFields: Array.from({ length: 10 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return { intensity: `tactic_${number}_intensity`, reportedIndicator: `tactic_${number}_reported` };
    }),
  };
}

export function validateColumnMappings(mappings: ColumnMapping[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const canonical = new Set<string>();
  for (const mapping of mappings) {
    if (canonical.has(mapping.canonicalColumn)) {
      issues.push({ code: "invalid_column_mapping", message: `Canonical column ${mapping.canonicalColumn} is mapped more than once.` });
    }
    canonical.add(mapping.canonicalColumn);
    if (mapping.canonicalColumn === "promotion_intensity" && mapping.transformation && mapping.transformation !== "normalize_0_1" && mapping.transformation !== "none") {
      issues.push({ code: "invalid_file_type", message: "Promotion intensity must use the confirmed 0–1 scale." });
    }
  }
  return issues;
}

export function validatePipelineDefinition(definition: AnalyticsPipelineDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  if (definition.contractVersion !== ANALYTICS_CONTRACT_VERSION || !definition.nodes.length) {
    return [{ code: "invalid_pipeline", message: "A pipeline must use analytics.v1 and contain at least one node." }];
  }
  for (const node of definition.nodes) {
    if (!node.id || nodeIds.has(node.id)) issues.push({ code: "invalid_pipeline", message: "Pipeline node IDs must be unique and non-empty." });
    for (const inputId of node.inputIds) {
      if (!nodeIds.has(inputId)) issues.push({ code: "invalid_pipeline", message: `Node ${node.id} references an unavailable input ${inputId}.` });
    }
    nodeIds.add(node.id);
  }
  if (definition.nodes.at(-1)?.type !== "OUTPUT_DATASET") {
    issues.push({ code: "invalid_pipeline", message: "The final pipeline node must be OUTPUT_DATASET." });
  }
  return issues.concat(validateColumnMappings(definition.columnMappings));
}

export function validateModelTrainingRequest(request: ModelTrainingRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (request.contractVersion !== ANALYTICS_CONTRACT_VERSION || request.target !== "sales_units") {
    issues.push({ code: "invalid_model_training", message: "Training must use analytics.v1 with sales_units as the target." });
  }
  if (!request.trainingDatasetVersionId) {
    issues.push({ code: "invalid_model_training", message: "A processed training dataset version is required." });
  }
  if (!request.candidateAlgorithms.length || request.candidateAlgorithms.some((algorithm) => !["ridge_linear", "poisson_glm", "histogram_gradient_boosting"].includes(algorithm))) {
    issues.push({ code: "invalid_model_training", message: "Choose one or more fixed reviewed model algorithms." });
  }
  if (request.validationWeeks !== undefined && (!Number.isInteger(request.validationWeeks) || request.validationWeeks < 1 || request.validationWeeks > 52)) {
    issues.push({ code: "invalid_model_training", message: "Validation weeks must be an integer from 1 to 52." });
  }
  if (request.thresholds?.maxWape !== undefined && (!Number.isFinite(request.thresholds.maxWape) || request.thresholds.maxWape < 0 || request.thresholds.maxWape > 1000)) {
    issues.push({ code: "invalid_model_training", message: "Maximum WAPE must be a non-negative percentage." });
  }
  return issues;
}

function isPromotionIntensity(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validatePredictionRequest(request: PredictionRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (request.mode === "historical_what_if") {
    if (!request.customerId || !isPromotionIntensity(request.promotionIntensity)) {
      issues.push({ code: "invalid_prediction", message: "Historical what-if requires a customer and 0–1 promotion intensity." });
    }
    return issues;
  }
  if (!Array.isArray(request.rows) || request.rows.length !== 4) {
    issues.push({ code: "invalid_prediction", message: "Future forecasts require exactly four weekly rows entered in the app." });
    return issues;
  }
  for (const row of request.rows) {
    if (!row.productId || !row.customerId || !/^\d{4}-(?:W)?\d{1,2}$/.test(row.weekNum) || !Number.isFinite(row.consumerPrice) || !Number.isFinite(row.numStores) || !isPromotionIntensity(row.promotionIntensity)) {
      issues.push({ code: "invalid_prediction", message: "Each future forecast row requires product, customer, week, price, availability, and 0–1 promotion intensity." });
      break;
    }
  }
  return issues;
}
