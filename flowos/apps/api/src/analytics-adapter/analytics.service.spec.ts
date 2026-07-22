import { BadRequestException } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService upload validation", () => {
  const metadata = {
    assertProjectInWorkspace: jest.fn(),
    findOrCreateDataset: jest.fn(),
    createUploadingVersion: jest.fn(),
    markVersionProfiled: jest.fn(),
    markVersionFailed: jest.fn(),
    listProjects: jest.fn(),
    createProject: jest.fn(),
    listProfiledDatasetVersions: jest.fn(),
    findOrCreatePipelineTemplate: jest.fn(),
    createPipelineVersion: jest.fn(),
    listPipelineVersions: jest.fn(),
    listPipelineRuns: jest.fn(),
    getPipelineVersion: jest.fn(),
    getDatasetVersions: jest.fn(),
    createProcessingVersion: jest.fn(),
    createPipelineRun: jest.fn(),
    markPipelineRunSucceeded: jest.fn(),
    markPipelineRunFailed: jest.fn(),
  };
  const storage = { uploadImmutable: jest.fn() };
  const worker = { profileCsv: jest.fn(), processDataset: jest.fn() };
  const service = new AnalyticsService(metadata as never, storage as never, worker as never);

  beforeEach(() => jest.resetAllMocks());

  it("rejects a non-CSV before invoking worker or storage", async () => {
    await expect(service.uploadCsv("workspace_1", "project_1", "Sales", { originalname: "sales.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 10, buffer: Buffer.from("x") }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(worker.profileCsv).not.toHaveBeenCalled();
    expect(storage.uploadImmutable).not.toHaveBeenCalled();
  });

  it("profiles before creating metadata and persists only profile metadata", async () => {
    const profile = { encoding: "utf-8", delimiter: ",", hasHeader: true, dataRowCount: 1, columns: [], warnings: [] };
    metadata.findOrCreateDataset.mockResolvedValue({ id: "dataset_1" });
    metadata.createUploadingVersion.mockResolvedValue("version_1");
    metadata.markVersionProfiled.mockResolvedValue({ id: "version_1", profile, status: "profiled" });
    worker.profileCsv.mockResolvedValue(profile);
    storage.uploadImmutable.mockResolvedValue({ bucket: "analytics-raw" });

    const result = await service.uploadCsv("workspace_1", "project_1", "Sales", { originalname: "sales.csv", mimetype: "text/csv", size: 12, buffer: Buffer.from("ProductId\nA\n") });

    expect(metadata.assertProjectInWorkspace).toHaveBeenCalledWith("project_1", "workspace_1");
    expect(worker.profileCsv.mock.invocationCallOrder[0]).toBeLessThan(metadata.findOrCreateDataset.mock.invocationCallOrder[0]);
    expect(storage.uploadImmutable).toHaveBeenCalledWith("raw", expect.stringContaining("workspace_1/projects/project_1/raw/"), expect.any(Buffer), "text/csv", expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(result.status).toBe("profiled");
  });

  it("records a failed version when immutable storage rejects the upload", async () => {
    const profile = { encoding: "utf-8", delimiter: ",", hasHeader: true, dataRowCount: 1, columns: [], warnings: [] };
    metadata.findOrCreateDataset.mockResolvedValue({ id: "dataset_1" });
    metadata.createUploadingVersion.mockResolvedValue("version_1");
    worker.profileCsv.mockResolvedValue(profile);
    storage.uploadImmutable.mockRejectedValue(new Error("bucket missing"));

    await expect(service.uploadCsv("workspace_1", "project_1", "Sales", { originalname: "sales.csv", mimetype: "text/csv", size: 12, buffer: Buffer.from("ProductId\nA\n") })).rejects.toThrow("bucket missing");
    expect(metadata.markVersionFailed).toHaveBeenCalledWith("version_1", "bucket missing");
  });

  it("rejects pipeline source bindings that do not match CSV input nodes", async () => {
    metadata.getPipelineVersion.mockResolvedValue({ id: "pipe_1", definition: { nodes: [{ id: "sales", type: "CSV_INPUT", config: { sourceId: "sales" } }, { id: "output", type: "OUTPUT_DATASET", config: {} }] } });
    metadata.getDatasetVersions.mockResolvedValue([{ id: "version_1", storage: { bucket: "analytics-raw", path: "sales.csv", artifactKind: "raw" } }]);

    await expect(service.runPipeline("workspace_1", "project_1", "pipe_1", [{ sourceId: "calendar", datasetVersionId: "version_1" }])).rejects.toBeInstanceOf(BadRequestException);
    expect(metadata.createProcessingVersion).not.toHaveBeenCalled();
  });

  it("persists a successful fixed-code pipeline result without raw rows", async () => {
    const definition = { nodes: [{ id: "sales", type: "CSV_INPUT", config: { sourceId: "sales" } }, { id: "output", type: "OUTPUT_DATASET", config: {} }] };
    metadata.getPipelineVersion.mockResolvedValue({ id: "pipe_1", definition });
    metadata.getDatasetVersions.mockResolvedValue([{ id: "version_1", storage: { bucket: "analytics-raw", path: "sales.csv", artifactKind: "raw" } }]);
    metadata.createProcessingVersion.mockResolvedValue({ id: "processed_1" });
    metadata.createPipelineRun.mockResolvedValue({ id: "run_1", status: "running" });
    worker.processDataset.mockResolvedValue({ id: "job_1", status: "succeeded", outputArtifact: { bucket: "analytics-processed", path: "processed.csv", artifactKind: "processed", sha256: "a".repeat(64) }, outputByteSize: 42, outputProfile: { dataRowCount: 1 }, qualityReport: { inputRowCount: 1, outputRowCount: 1, findings: [] } });

    const run = await service.runPipeline("workspace_1", "project_1", "pipe_1", [{ sourceId: "sales", datasetVersionId: "version_1" }]);

    expect(run.status).toBe("succeeded");
    expect(worker.processDataset).toHaveBeenCalledWith(expect.objectContaining({ type: "PROCESS_DATASET", inputArtifacts: [{ bucket: "analytics-raw", path: "sales.csv", artifactKind: "raw" }] }));
    expect(metadata.markPipelineRunSucceeded).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project_1", outputByteSize: 42 }));
  });
});
