import test from "node:test";
import assert from "node:assert/strict";
import { MAX_CSV_BYTES, buildAnalyticsObjectPath, defaultFeatureSet, validateColumnMappings, validateCsvUploadMetadata, validatePipelineDefinition } from "../src/index.js";

test("CSV upload validation enforces file type and size", () => {
  assert.deepEqual(validateCsvUploadMetadata({ fileName: "sales.csv", byteSize: MAX_CSV_BYTES, contentType: "text/csv" }), []);
  assert.equal(validateCsvUploadMetadata({ fileName: "sales.xlsx", byteSize: 1 }).at(0)?.code, "invalid_file_type");
  assert.equal(validateCsvUploadMetadata({ fileName: "sales.csv", byteSize: MAX_CSV_BYTES + 1 }).at(0)?.code, "file_too_large");
  assert.equal(validateCsvUploadMetadata({ fileName: "../sales.csv", byteSize: 1 }).at(-1)?.code, "invalid_file_name");
});

test("object paths are workspace and project scoped", () => {
  assert.equal(buildAnalyticsObjectPath("workspace_1", "project_1", "raw", "version_1", "sales data.csv"), "workspace_1/projects/project_1/raw/version_1/sales_data.csv");
  assert.throws(() => buildAnalyticsObjectPath("../workspace", "project_1", "raw", "version_1", "sales.csv"));
});

test("default feature set retains unknown tactics and excludes leakage risks", () => {
  const featureSet = defaultFeatureSet();
  assert.deepEqual(featureSet.excludedByDefault, ["baseline_units", "sales_dollars"]);
  assert.equal(featureSet.tacticFields[0].reportedIndicator, "tactic_01_reported");
  assert.equal(featureSet.tacticFields.length, 10);
});

test("column mappings reject ambiguous canonical fields", () => {
  const issues = validateColumnMappings([
    { sourceColumn: "Promotion", canonicalColumn: "promotion_intensity", transformation: "normalize_0_1" },
    { sourceColumn: "PromoFlag", canonicalColumn: "promotion_intensity", transformation: "none" },
  ]);
  assert.equal(issues.length, 1);
});

test("pipeline validation requires a final output node and prior inputs", () => {
  const issues = validatePipelineDefinition({
    contractVersion: "analytics.v1", id: "pipeline_1", projectId: "project_1", version: 1, columnMappings: [],
    nodes: [{ id: "output", type: "OUTPUT_DATASET", inputIds: ["missing"], config: {} }],
  });
  assert.equal(issues.some((issue) => issue.code === "invalid_pipeline"), true);
});
