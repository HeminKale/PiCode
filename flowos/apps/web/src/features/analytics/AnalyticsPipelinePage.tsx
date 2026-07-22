"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type AnalyticsPipelineDefinition } from "@/lib/api";

type DatasetVersion = Awaited<ReturnType<typeof api.listAnalyticsDatasetVersions>>[number];
type PipelineVersion = Awaited<ReturnType<typeof api.listAnalyticsPipelines>>[number];
type PipelineRun = Awaited<ReturnType<typeof api.listAnalyticsPipelineRuns>>[number];
type QualityReport = Awaited<ReturnType<typeof api.listAnalyticsQualityReports>>[number];

const initialMappings: Array<[string, string]> = [
  ["ProductId", "product_id"], ["CustomerId", "customer_id"], ["WeekNum", "week_num"],
  ["IsPromotion", "promotion_intensity"], ["SalesUnits", "sales_units"],
];

function definitionFor(projectId: string, mappings: Array<[string, string]>): AnalyticsPipelineDefinition {
  const mapping = Object.fromEntries(mappings.filter(([source, canonical]) => source && canonical));
  const canonical = new Set(Object.values(mapping));
  const numeric = ["promotion_intensity", "sales_units", "num_stores", "consumer_price"].filter((column) => canonical.has(column));
  const nodes = [
    { id: "sales", type: "CSV_INPUT", inputIds: [], config: { sourceId: "sales" } },
    { id: "sales_rename", type: "RENAME_COLUMNS", inputIds: ["sales"], config: { mappings: mapping } },
    { id: "sales_schema", type: "SCHEMA_VALIDATE", inputIds: ["sales_rename"], config: { requiredColumns: ["product_id", "customer_id", "week_num", "sales_units"].filter((column) => canonical.has(column)) } },
    { id: "sales_cast", type: "CAST_COLUMNS", inputIds: ["sales_schema"], config: { columns: Object.fromEntries(numeric.map((column) => [column, "number"])) } },
    { id: "calendar", type: "CSV_INPUT", inputIds: [], config: { sourceId: "calendar" } },
    { id: "calendar_rename", type: "RENAME_COLUMNS", inputIds: ["calendar"], config: { mappings: { "Year-WeekNumber": "week_num", WeekStart: "week_start", WeekEnd: "week_end" } } },
    { id: "calendar_schema", type: "SCHEMA_VALIDATE", inputIds: ["calendar_rename"], config: { requiredColumns: ["week_num"] } },
    { id: "join_calendar", type: "JOIN", inputIds: ["sales_cast", "calendar_schema"], config: { leftKeys: ["week_num"], rightKeys: ["week_num"], joinType: "left", duplicateKeyPolicy: "reject", reportMissingMatch: true } },
    { id: "validated_grain", type: "DEDUPLICATE", inputIds: ["join_calendar"], config: { keys: ["product_id", "customer_id", "week_num"], policy: "reject" } },
    { id: "output", type: "OUTPUT_DATASET", inputIds: ["validated_grain"], config: {} },
  ];
  return { contractVersion: "analytics.v1", id: `sales-calendar-${projectId}`, projectId, version: 1, nodes, columnMappings: mappings.filter(([source, canonical]) => source && canonical).map(([sourceColumn, canonicalColumn]) => ({ sourceColumn, canonicalColumn, transformation: canonicalColumn === "promotion_intensity" ? "normalize_0_1" : "none" })) };
}

export function AnalyticsPipelinePage({ projectId }: { projectId: string }) {
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [pipelines, setPipelines] = useState<PipelineVersion[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [qualityReports, setQualityReports] = useState<QualityReport[]>([]);
  const [mappings, setMappings] = useState<Array<[string, string]>>([...initialMappings]);
  const [salesVersionId, setSalesVersionId] = useState("");
  const [calendarVersionId, setCalendarVersionId] = useState("");
  const [pipelineName, setPipelineName] = useState("Sales and calendar processor");
  const [outputDatasetName, setOutputDatasetName] = useState("Weekly sales features");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => definitionFor(projectId, mappings), [projectId, mappings]);

  async function refresh() {
    const [nextDatasets, nextPipelines, nextRuns, nextReports] = await Promise.all([api.listAnalyticsDatasetVersions(projectId), api.listAnalyticsPipelines(projectId), api.listAnalyticsPipelineRuns(projectId), api.listAnalyticsQualityReports(projectId)]);
    setDatasets(nextDatasets); setPipelines(nextPipelines); setRuns(nextRuns); setQualityReports(nextReports);
    setSalesVersionId((current) => current || nextDatasets[0]?.id || "");
    setCalendarVersionId((current) => current || nextDatasets[1]?.id || "");
  }

  useEffect(() => { refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load the pipeline workspace.")).finally(() => setLoading(false)); }, [projectId]);

  async function savePipeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError(null);
    try {
      await api.createAnalyticsPipeline(projectId, { name: pipelineName, definition: preview, isApproved: true });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save pipeline version."); }
    finally { setWorking(false); }
  }

  async function runPipeline(versionId: string) {
    if (!salesVersionId || !calendarVersionId) { setError("Select profiled sales and calendar versions before running."); return; }
    setWorking(true); setError(null);
    try {
      await api.runAnalyticsPipeline(projectId, versionId, { sources: [{ sourceId: "sales", datasetVersionId: salesVersionId }, { sourceId: "calendar", datasetVersionId: calendarVersionId }], outputDatasetName });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pipeline run failed."); }
    finally { setWorking(false); }
  }

  return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <a href="/analytics" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">&lt;- Analytics projects</a>
      <div className="mt-5 border-b border-slate-200 pb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Analytics / Build pipeline</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Sales and calendar processor</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A reviewable fixed-code pipeline. It validates Product x Customer x Week grain, preserves source lineage, and sends only Storage references to the worker.</p></div>
      {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {loading ? <p className="mt-6 text-sm text-slate-500">Loading pipeline workspace...</p> : <div className="mt-7 grid gap-7 lg:grid-cols-[1.2fr_.8fr]">
        <form onSubmit={savePipeline} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><h2 className="text-base font-semibold">1. Map the sales columns</h2><p className="mt-1 text-sm text-slate-600">Technical canonical names stay stable. Promotion is numeric 0-1; BaselineUnits is intentionally not mapped by default.</p></div>
          <label className="block text-sm font-medium">Pipeline name<input value={pipelineName} onChange={(event) => setPipelineName(event.target.value)} maxLength={120} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Sales CSV column</th><th className="pb-2">Canonical column</th></tr></thead><tbody>{mappings.map(([source, canonical], index) => <tr key={index} className="border-t border-slate-100"><td className="py-2 pr-3"><input value={source} onChange={(event) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? [event.target.value, item[1]] : item))} className="w-full rounded border border-slate-300 px-2 py-1.5" /></td><td className="py-2"><input value={canonical} onChange={(event) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? [item[0], event.target.value] : item))} className="w-full rounded border border-slate-300 px-2 py-1.5" /></td></tr>)}</tbody></table></div>
          <button type="button" onClick={() => setMappings((current) => [...current, ["", ""]])} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">+ Add optional mapping</button>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-semibold">2. Reviewed graph</h3><ol className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">{preview.nodes.map((node) => <li key={node.id} className="rounded border border-slate-200 bg-white px-3 py-2"><span className="font-mono text-xs text-indigo-700">{node.type}</span><div>{node.id.replaceAll("_", " ")}</div></li>)}</ol></div>
          <button disabled={working} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save approved pipeline version</button>
        </form>
        <section className="space-y-6"><div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm"><h2 className="text-base font-semibold">3. Choose immutable inputs</h2><p className="mt-1 text-sm text-slate-600">Each input is read by the worker from private Storage and remains outside flowJson.</p><label className="mt-4 block text-sm font-medium">Sales version<select value={salesVersionId} onChange={(event) => setSalesVersionId(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Select a version</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.fileName} ({dataset.profile?.dataRowCount ?? 0} rows)</option>)}</select></label><label className="mt-4 block text-sm font-medium">Calendar version<select value={calendarVersionId} onChange={(event) => setCalendarVersionId(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Select a version</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.fileName} ({dataset.profile?.dataRowCount ?? 0} rows)</option>)}</select></label><label className="mt-4 block text-sm font-medium">Processed dataset name<input value={outputDatasetName} onChange={(event) => setOutputDatasetName(event.target.value)} maxLength={120} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-semibold">4. Saved versions and runs</h2>{pipelines.length === 0 ? <p className="mt-3 text-sm text-slate-500">Save the reviewed graph to create the first immutable pipeline version.</p> : <div className="mt-3 space-y-3">{pipelines.map((pipeline) => <div key={pipeline.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Version {pipeline.version}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">approved</span></div><button type="button" disabled={working} onClick={() => runPipeline(pipeline.id)} className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Run with selected inputs</button></div>)}</div>}<div className="mt-5 space-y-2">{runs.map((run) => <div key={run.id} className="rounded border border-slate-200 px-3 py-2 text-sm"><span className="font-medium capitalize">{run.status}</span><span className="ml-2 text-slate-500">{new Date(run.createdAt).toLocaleString()}</span>{run.errorSummary && <div className="mt-1 text-red-700">{run.errorSummary}</div>}</div>)}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-semibold">Latest data-quality report</h2>{qualityReports[0] ? <div className="mt-3"><p className="text-sm text-slate-600">{qualityReports[0].report.inputRowCount.toLocaleString()} input rows to {qualityReports[0].report.outputRowCount.toLocaleString()} output rows</p><ul className="mt-3 space-y-2 text-sm">{qualityReports[0].report.findings.length === 0 ? <li className="text-emerald-700">No findings reported.</li> : qualityReports[0].report.findings.map((finding, index) => <li key={`${finding.code}-${index}`} className="rounded border border-slate-200 px-3 py-2"><span className="font-medium capitalize">{finding.severity}</span><span className="ml-2">{finding.message}</span></li>)}</ul></div> : <p className="mt-3 text-sm text-slate-500">Run a saved pipeline to persist its quality report.</p>}</div>
        </section>
      </div>}
    </div>
  </main>;
}
