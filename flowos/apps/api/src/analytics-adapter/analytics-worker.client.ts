import { Injectable, ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import type { AnalyticsJob, AnalyticsModelFamily, CsvProfile, DataQualityReport, ModelMetrics, PredictionOutputSummary, StorageObjectRef } from "@flowos/analytics-contracts";

export type ProcessDatasetWorkerRequest = AnalyticsJob & {
  pipeline: Record<string, unknown>;
  sources: Array<{ sourceId: string; artifact: StorageObjectRef }>;
  outputArtifact: StorageObjectRef;
};

export type ProcessDatasetWorkerResult = {
  id: string;
  status: "succeeded";
  outputArtifact: StorageObjectRef;
  outputByteSize: number;
  outputProfile: CsvProfile;
  qualityReport: DataQualityReport;
};

export type TrainModelWorkerRequest = AnalyticsJob & {
  trainingArtifact: StorageObjectRef;
  modelArtifact: StorageObjectRef & { contentType: "application/json" };
  trainingRequest: Record<string, unknown>;
};

export type TrainModelWorkerResult = {
  id: string;
  status: "succeeded";
  modelArtifact: StorageObjectRef;
  modelFamily: AnalyticsModelFamily;
  metrics: ModelMetrics;
  evaluations: Array<{ algorithm: AnalyticsModelFamily; metrics: ModelMetrics; segmentErrors: Record<string, ModelMetrics>; selected: boolean }>;
  isApproved: boolean;
  dataFingerprint: string;
  featureSet: Record<string, unknown>;
};

export type PredictionWorkerRequest = AnalyticsJob & {
  modelArtifact: StorageObjectRef;
  historyArtifact: StorageObjectRef;
  predictionArtifact: StorageObjectRef & { contentType: "text/csv" };
  scenario: Record<string, unknown>;
};

export type PredictionWorkerResult = {
  id: string;
  status: "succeeded";
  predictionArtifact: StorageObjectRef;
  outputByteSize: number;
  summary: PredictionOutputSummary;
};

@Injectable()
export class AnalyticsWorkerClient {
  private readonly baseUrl = process.env.ANALYTICS_WORKER_URL;
  private readonly sharedSecret = process.env.ANALYTICS_WORKER_SHARED_SECRET;
  private readonly timeoutMs = Number(process.env.ANALYTICS_WORKER_TIMEOUT_MS ?? "60000");

  async profileCsv(csv: Buffer): Promise<CsvProfile> {
    if (!this.baseUrl) {
      throw new ServiceUnavailableException("Analytics profiling is unavailable: configure ANALYTICS_WORKER_URL.");
    }
    const headers = this.headers("text/csv");
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/profile`, {
        method: "POST",
        headers,
        body: csv as unknown as BodyInit,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException("Analytics profiling worker is unavailable.");
    }
    const payload = await response.json().catch(() => ({})) as CsvProfile & { error?: string };
    if (!response.ok) {
      throw new UnprocessableEntityException(payload.error ?? "The CSV could not be profiled.");
    }
    return payload;
  }

  async processDataset(job: ProcessDatasetWorkerRequest): Promise<ProcessDatasetWorkerResult> {
    return this.submitJob<ProcessDatasetWorkerResult>(job, "The pipeline could not process the selected dataset versions.");
  }

  async trainModel(job: TrainModelWorkerRequest): Promise<TrainModelWorkerResult> {
    return this.submitJob<TrainModelWorkerResult>(job, "The selected dataset could not train a model.");
  }

  async predict(job: PredictionWorkerRequest): Promise<PredictionWorkerResult> {
    return this.submitJob<PredictionWorkerResult>(job, "The requested prediction could not be created.");
  }

  private async submitJob<T>(job: AnalyticsJob, fallback: string): Promise<T> {
    if (!this.baseUrl) throw new ServiceUnavailableException("Analytics processing is unavailable: configure ANALYTICS_WORKER_URL.");
    const headers = this.headers("application/json");
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/jobs`, {
        method: "POST",
        headers,
        body: JSON.stringify(job),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException("Analytics processing worker is unavailable.");
    }
    const payload = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new UnprocessableEntityException(payload.error ?? fallback);
    return payload;
  }

  private headers(contentType: string): Record<string, string> {
    if (!this.sharedSecret) {
      throw new ServiceUnavailableException("Analytics worker security is unavailable: configure ANALYTICS_WORKER_SHARED_SECRET.");
    }
    return {
      "Content-Type": contentType,
      "x-analytics-worker-secret": this.sharedSecret,
    };
  }
}
