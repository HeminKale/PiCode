"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type ForecastRowInput } from "@/lib/api";

type DatasetVersion = Awaited<ReturnType<typeof api.listAnalyticsDatasetVersions>>[number];
type ModelVersion = Awaited<ReturnType<typeof api.listAnalyticsModels>>[number];
type PredictionRun = Awaited<ReturnType<typeof api.listAnalyticsPredictions>>[number];
type ForecastInputField = Exclude<keyof ForecastRowInput, "tactics">;

function blankForecastRows(): ForecastRowInput[] {
  return Array.from({ length: 4 }, (_, index) => ({ productId: "", customerId: "", weekNum: `2026-${String(index + 1).padStart(2, "0")}`, consumerPrice: 0, numStores: 0, promotionIntensity: 0 }));
}

export function AnalyticsPredictionsPage({ projectId }: { projectId: string }) {
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [runs, setRuns] = useState<PredictionRun[]>([]);
  const [mode, setMode] = useState<"future_forecast" | "historical_what_if">("future_forecast");
  const [modelVersionId, setModelVersionId] = useState("");
  const [historyDatasetVersionId, setHistoryDatasetVersionId] = useState("");
  const [futureRows, setFutureRows] = useState<ForecastRowInput[]>(blankForecastRows);
  const [customerId, setCustomerId] = useState("");
  const [productIds, setProductIds] = useState("");
  const [weekNums, setWeekNums] = useState("");
  const [promotionIntensity, setPromotionIntensity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processed = useMemo(() => datasets.filter((dataset) => dataset.status === "processed"), [datasets]);
  const approved = useMemo(() => models.filter((model) => model.isApproved && model.status === "succeeded"), [models]);

  async function refresh() {
    const [nextModels, nextDatasets, nextRuns] = await Promise.all([api.listAnalyticsModels(projectId), api.listAnalyticsDatasetVersions(projectId), api.listAnalyticsPredictions(projectId)]);
    setModels(nextModels); setDatasets(nextDatasets); setRuns(nextRuns);
    setModelVersionId((current) => current || nextModels.find((model) => model.isApproved && model.status === "succeeded")?.id || "");
    setHistoryDatasetVersionId((current) => current || nextDatasets.find((dataset) => dataset.status === "processed")?.id || "");
  }

  useEffect(() => { refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load predictions.")).finally(() => setLoading(false)); }, [projectId]);

  function changeRow(index: number, key: ForecastInputField, value: string) {
    setFutureRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: ["consumerPrice", "numStores", "promotionIntensity"].includes(key) ? Number(value) : value } : row));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modelVersionId || !historyDatasetVersionId) { setError("Select an approved model and processed history dataset."); return; }
    setWorking(true); setError(null);
    try {
      if (mode === "future_forecast") {
        await api.createAnalyticsPrediction(projectId, modelVersionId, { mode, historyDatasetVersionId, rows: futureRows });
      } else {
        await api.createAnalyticsPrediction(projectId, modelVersionId, { mode, historyDatasetVersionId, customerId, productIds: productIds.split(",").map((value) => value.trim()).filter(Boolean), weekNums: weekNums.split(",").map((value) => value.trim()).filter(Boolean), promotionIntensity });
      }
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Prediction failed."); }
    finally { setWorking(false); }
  }

  return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-6xl"><div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-indigo-700"><a href="/analytics">Analytics projects</a><a href={`/analytics/projects/${projectId}/pipeline`}>Build pipeline</a><a href={`/analytics/projects/${projectId}/model`}>Model</a></div><div className="mt-5 border-b border-slate-200 pb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Analytics / Predictions</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Promotion scenarios</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Every request compares the selected promotion plan with an otherwise identical no-promotion baseline. Results are modelled uplift, not proof of causation.</p></div>
      {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {loading ? <p className="mt-6 text-sm text-slate-500">Loading prediction workspace...</p> : <div className="mt-7 grid gap-7 lg:grid-cols-[1.2fr_.8fr]">
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-2"><button type="button" onClick={() => setMode("future_forecast")} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "future_forecast" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>Four-week forecast</button><button type="button" onClick={() => setMode("historical_what_if")} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "historical_what_if" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>Historical what-if</button></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Approved model<select value={modelVersionId} onChange={(event) => setModelVersionId(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">Select model</option>{approved.map((model) => <option key={model.id} value={model.id}>{model.modelFamily.replaceAll("_", " ")} · WAPE {model.metrics.wape.toFixed(2)}%</option>)}</select></label><label className="block text-sm font-medium">Processed history<select value={historyDatasetVersionId} onChange={(event) => setHistoryDatasetVersionId(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">Select history</option>{processed.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.fileName}</option>)}</select></label></div>
          {mode === "future_forecast" ? <div className="mt-6"><h2 className="text-base font-semibold">Future plan — fixed four-week horizon</h2><p className="mt-1 text-sm text-slate-600">Price, availability, promotion intensity, product/customer scope, and prior history are mandatory. Tactics are optional and remain unknown unless supplied.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Week</th><th className="pb-2">Product</th><th className="pb-2">Customer</th><th className="pb-2">Price</th><th className="pb-2">Stores</th><th className="pb-2">Promotion 0–1</th></tr></thead><tbody>{futureRows.map((row, index) => <tr key={index} className="border-t border-slate-100">{(["weekNum", "productId", "customerId", "consumerPrice", "numStores", "promotionIntensity"] as ForecastInputField[]).map((key) => <td key={key} className="py-2 pr-2"><input required={true} type={["consumerPrice", "numStores", "promotionIntensity"].includes(key) ? "number" : "text"} min={key === "promotionIntensity" ? 0 : undefined} max={key === "promotionIntensity" ? 1 : undefined} step={key === "promotionIntensity" ? "0.01" : undefined} value={row[key]} onChange={(event) => changeRow(index, key, event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5" /></td>)}</tr>)}</tbody></table></div></div> : <div className="mt-6"><h2 className="text-base font-semibold">Historical what-if scope</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Customer ID<input required value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="block text-sm font-medium">Promotion intensity (0–1)<input required type="number" min={0} max={1} step="0.01" value={promotionIntensity} onChange={(event) => setPromotionIntensity(Number(event.target.value))} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="block text-sm font-medium">Product IDs <span className="font-normal text-slate-500">(comma-separated, optional)</span><input value={productIds} onChange={(event) => setProductIds(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="block text-sm font-medium">Weeks <span className="font-normal text-slate-500">(comma-separated, optional)</span><input value={weekNums} onChange={(event) => setWeekNums(event.target.value)} placeholder="2026-01, 2026-02" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label></div></div>}
          <button disabled={working || !approved.length || !processed.length} className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{working ? "Creating Storage-backed output..." : "Create paired prediction"}</button>
        </form>
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm"><h2 className="text-base font-semibold">Prediction runs</h2>{runs.length === 0 ? <p className="mt-3 text-sm text-slate-500">No prediction output yet.</p> : <div className="mt-4 space-y-3">{runs.map((run) => <article key={run.id} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold capitalize">{run.status}</span><span className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</span></div>{run.summary && <><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Rows</dt><dd className="font-semibold">{run.summary.rowCount}</dd></div><div><dt className="text-slate-500">Weighted increment</dt><dd className="font-semibold">{run.summary.weightedPercentIncrement.toFixed(2)}%</dd></div><div><dt className="text-slate-500">Baseline units</dt><dd className="font-semibold">{run.summary.totalBaselineUnits.toFixed(2)}</dd></div><div><dt className="text-slate-500">Incremental units</dt><dd className="font-semibold">{run.summary.totalIncrementalUnits.toFixed(2)}</dd></div></dl>{run.summary.displayRows?.length ? <div className="mt-4 overflow-x-auto"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Approved business view</div><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2">Customer</th><th className="pb-2">Product</th><th className="pb-2">Week</th><th className="pb-2">Baseline</th><th className="pb-2">Promoted</th><th className="pb-2">Incremental</th><th className="pb-2">Increment</th></tr></thead><tbody>{run.summary.displayRows.map((row, index) => <tr key={`${row.customerId}-${row.productId}-${row.weekNum}-${index}`} className="border-t border-slate-100"><td className="py-1.5">{row.customerId}</td><td className="py-1.5">{row.productId}</td><td className="py-1.5">{row.weekNum}</td><td className="py-1.5">{row.baselineUnits.toFixed(2)}</td><td className="py-1.5">{row.promotedUnits.toFixed(2)}</td><td className="py-1.5">{row.incrementalUnits.toFixed(2)}</td><td className="py-1.5">{row.percentIncrement.toFixed(2)}%</td></tr>)}</tbody></table></div> : null}</>}<p className="mt-3 text-xs leading-5 text-slate-500">This is a bounded, rounded display projection. The complete product/customer prediction CSV remains immutable private Storage and is never put in FlowOS JSON.</p></article>)}</div>}</section>
      </div>}
    </div>
  </main>;
}
