import { createSyntheticShopFixture } from "@flowos/analytics-fixtures";
import { api, type AnalyticsPipelineDefinition, type PredictionSummary } from "@/lib/api";

function demoPipeline(projectId: string): AnalyticsPipelineDefinition {
  const mappings: Array<[string, string]> = [
    ["ProductId", "product_id"], ["CustomerId", "customer_id"], ["WeekNum", "week_num"],
    ["NumStores", "num_stores"], ["ConsumerPrice", "consumer_price"], ["IsPromotion", "promotion_intensity"],
    ["Tactic1", "tactic_01_intensity"], ["Tactic2", "tactic_02_intensity"], ["SalesUnits", "sales_units"],
  ];
  const mapping = Object.fromEntries(mappings);
  return {
    contractVersion: "analytics.v1", id: `synthetic-shop-${projectId}`, projectId, version: 1,
    columnMappings: mappings.map(([sourceColumn, canonicalColumn]) => ({ sourceColumn, canonicalColumn, transformation: canonicalColumn === "promotion_intensity" ? "normalize_0_1" as const : "none" as const })),
    nodes: [
      { id: "sales", type: "CSV_INPUT", inputIds: [], config: { sourceId: "sales" } },
      { id: "sales_rename", type: "RENAME_COLUMNS", inputIds: ["sales"], config: { mappings: mapping } },
      { id: "sales_validate", type: "SCHEMA_VALIDATE", inputIds: ["sales_rename"], config: { requiredColumns: ["product_id", "customer_id", "week_num", "sales_units"] } },
      { id: "sales_cast", type: "CAST_COLUMNS", inputIds: ["sales_validate"], config: { columns: { num_stores: "number", consumer_price: "number", promotion_intensity: "number", sales_units: "number" } } },
      { id: "calendar", type: "CSV_INPUT", inputIds: [], config: { sourceId: "calendar" } },
      { id: "calendar_rename", type: "RENAME_COLUMNS", inputIds: ["calendar"], config: { mappings: { "Year-WeekNumber": "week_num", WeekStart: "week_start", WeekEnd: "week_end" } } },
      { id: "calendar_validate", type: "SCHEMA_VALIDATE", inputIds: ["calendar_rename"], config: { requiredColumns: ["week_num"] } },
      { id: "join_calendar", type: "JOIN", inputIds: ["sales_cast", "calendar_validate"], config: { leftKeys: ["week_num"], rightKeys: ["week_num"], joinType: "left", duplicateKeyPolicy: "reject", reportMissingMatch: true } },
      { id: "validated_grain", type: "DEDUPLICATE", inputIds: ["join_calendar"], config: { keys: ["product_id", "customer_id", "week_num"], policy: "reject" } },
      { id: "output", type: "OUTPUT_DATASET", inputIds: ["validated_grain"], config: {} },
    ],
  };
}

export async function runSyntheticShopDemo(): Promise<{ projectId: string; summary?: PredictionSummary }> {
  const fixture = createSyntheticShopFixture({ customerCount: 2, weekCount: 20, seed: 202604 });
  const project = await api.createAnalyticsProject("Synthetic shop demo", "A deterministic 100-product shop fixture with a known promotion uplift signal.");
  const sales = await api.uploadAnalyticsDataset(project.id, "Synthetic weekly sales", new File([fixture.salesCsv], "synthetic-shop-sales.csv", { type: "text/csv" }));
  const calendar = await api.uploadAnalyticsDataset(project.id, "Synthetic calendar", new File([fixture.calendarCsv], "synthetic-shop-calendar.csv", { type: "text/csv" }));
  const pipeline = await api.createAnalyticsPipeline(project.id, { name: "Synthetic shop sales and calendar", description: "A4 deterministic demo pipeline", definition: demoPipeline(project.id), isApproved: true });
  await api.runAnalyticsPipeline(project.id, pipeline.id, { sources: [{ sourceId: "sales", datasetVersionId: sales.id }, { sourceId: "calendar", datasetVersionId: calendar.id }], outputDatasetName: "Synthetic shop features" });
  const datasets = await api.listAnalyticsDatasetVersions(project.id);
  const processed = datasets.find((dataset) => dataset.status === "processed");
  if (!processed) throw new Error("The demo pipeline did not produce a processed dataset.");
  const model = await api.trainAnalyticsModel(project.id, { contractVersion: "analytics.v1", trainingDatasetVersionId: processed.id, target: "sales_units", candidateAlgorithms: ["ridge_linear"], validationWeeks: 4, thresholds: { maxWape: 1000 } });
  if (!model.isApproved) throw new Error("The demo model was not approved.");
  const prediction = await api.createAnalyticsPrediction(project.id, model.id, { mode: "historical_what_if", historyDatasetVersionId: processed.id, customerId: fixture.customerIds[0], productIds: fixture.productIds.slice(0, 8), weekNums: ["2026-19", "2026-20"], promotionIntensity: 1 });
  return { projectId: project.id, summary: prediction.summary };
}
