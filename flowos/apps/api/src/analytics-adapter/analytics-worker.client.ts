import { Injectable, ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import type { AnalyticsJob, CsvProfile, DataQualityReport, StorageObjectRef } from "@flowos/analytics-contracts";

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

@Injectable()
export class AnalyticsWorkerClient {
  private readonly baseUrl = process.env.ANALYTICS_WORKER_URL;

  async profileCsv(csv: Buffer): Promise<CsvProfile> {
    if (!this.baseUrl) {
      throw new ServiceUnavailableException("Analytics profiling is unavailable: configure ANALYTICS_WORKER_URL.");
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/profile`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csv as unknown as BodyInit,
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
    if (!this.baseUrl) throw new ServiceUnavailableException("Analytics processing is unavailable: configure ANALYTICS_WORKER_URL.");
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
    } catch {
      throw new ServiceUnavailableException("Analytics processing worker is unavailable.");
    }
    const payload = await response.json().catch(() => ({})) as ProcessDatasetWorkerResult & { error?: string };
    if (!response.ok) throw new UnprocessableEntityException(payload.error ?? "The pipeline could not process the selected dataset versions.");
    return payload;
  }
}
