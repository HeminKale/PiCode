"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type AnalyticsTrainingRequest, type ModelMetrics } from "@/lib/api";

type DatasetVersion = Awaited<ReturnType<typeof api.listAnalyticsDatasetVersions>>[number];
type ModelVersion = Awaited<ReturnType<typeof api.listAnalyticsModels>>[number];
type Evaluation = Awaited<ReturnType<typeof api.listAnalyticsModelEvaluations>>[number];

const candidateAlgorithms: AnalyticsTrainingRequest["candidateAlgorithms"] = ["ridge_linear", "poisson_glm", "histogram_gradient_boosting"];

function Metrics({ metrics }: { metrics: ModelMetrics }) {
  return <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
    {[["WAPE", `${metrics.wape.toFixed(2)}%`], ["MAE", metrics.mae.toFixed(2)], ["RMSE", metrics.rmse.toFixed(2)], ["R²", metrics.r2.toFixed(3)], ["Bias", metrics.bias.toFixed(2)]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold text-slate-800">{value}</dd></div>)}
  </dl>;
}

export function AnalyticsModelPage({ projectId }: { projectId: string }) {
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [datasetVersionId, setDatasetVersionId] = useState("");
  const [validationWeeks, setValidationWeeks] = useState(4);
  const [maxWape, setMaxWape] = useState(100);
  const [includeBaseline, setIncludeBaseline] = useState(false);
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const processedDatasets = useMemo(() => datasets.filter((dataset) => dataset.status === "processed"), [datasets]);

  async function refresh() {
    const [nextDatasets, nextModels, nextEvaluations] = await Promise.all([api.listAnalyticsDatasetVersions(projectId), api.listAnalyticsModels(projectId), api.listAnalyticsModelEvaluations(projectId)]);
    setDatasets(nextDatasets); setModels(nextModels); setEvaluations(nextEvaluations);
    setDatasetVersionId((current) => current || nextDatasets.find((dataset) => dataset.status === "processed")?.id || "");
  }

  useEffect(() => { refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load model training.")).finally(() => setLoading(false)); }, [projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!datasetVersionId) { setError("Run the A2 pipeline first so a processed feature dataset can be selected."); return; }
    setWorking(true); setError(null);
    try {
      await api.trainAnalyticsModel(projectId, { contractVersion: "analytics.v1", trainingDatasetVersionId: datasetVersionId, target: "sales_units", candidateAlgorithms, includeBaselineUnits: includeBaseline, validationWeeks, thresholds: { maxWape } });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Model training failed."); }
    finally { setWorking(false); }
  }

  async function approve(modelVersionId: string) {
    setWorking(true); setError(null);
    try { await api.approveAnalyticsModel(projectId, modelVersionId); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Model approval failed."); }
    finally { setWorking(false); }
  }

  return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-indigo-700"><a href="/analytics">Analytics projects</a><a href={`/analytics/projects/${projectId}/pipeline`}>Build pipeline</a><a href={`/analytics/projects/${projectId}/predictions`}>Predictions</a></div>
      <div className="mt-5 border-b border-slate-200 pb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Analytics / Model</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Baseline and promotion model</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Fixed reviewed algorithms run in the Analytics worker. Model artifacts and training data remain in private Storage; results describe modelled uplift, not causal proof.</p></div>
      {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {loading ? <p className="mt-6 text-sm text-slate-500">Loading model workspace...</p> : <div className="mt-7 grid gap-7 lg:grid-cols-[.9fr_1.1fr]">
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm"><h2 className="text-base font-semibold">Train a version</h2><p className="mt-1 text-sm text-slate-600">Latest contiguous weeks are held out for validation. A manager must explicitly approve a quality-eligible version before prediction.</p>
          <label className="mt-5 block text-sm font-medium">Processed feature dataset<select required value={datasetVersionId} onChange={(event) => setDatasetVersionId(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Select processed dataset</option>{processedDatasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.fileName} ({dataset.profile?.dataRowCount ?? 0} rows)</option>)}</select></label>
          <label className="mt-4 block text-sm font-medium">Validation weeks<input type="number" min={1} max={52} value={validationWeeks} onChange={(event) => setValidationWeeks(Number(event.target.value))} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
          <label className="mt-4 block text-sm font-medium">Approval maximum WAPE (%)<input type="number" min={0} value={maxWape} onChange={(event) => setMaxWape(Number(event.target.value))} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
          <label className="mt-4 flex gap-2 text-sm leading-5"><input type="checkbox" checked={includeBaseline} onChange={(event) => setIncludeBaseline(event.target.checked)} /><span><span className="font-medium">BaselineUnits is available before outcome</span><br /><span className="text-slate-600">Off by default because it is usually leakage.</span></span></label>
          <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-950"><div className="font-semibold">Reviewed candidates</div><ul className="mt-1 list-disc pl-5 text-indigo-900"><li>Regularized linear regression</li><li>Poisson-style GLM</li><li>Histogram gradient boosting</li></ul></div>
          <button disabled={working || !processedDatasets.length} className="mt-5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{working ? "Training fixed models..." : "Train model version"}</button>
        </form>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-semibold">Model versions</h2>{models.length === 0 ? <p className="mt-3 text-sm text-slate-500">No trained versions yet. Process a feature dataset, then train the reviewed candidates.</p> : <div className="mt-4 space-y-4">{models.map((model) => <article key={model.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-semibold">{model.modelFamily.replaceAll("_", " ")}</div><div className="text-xs text-slate-500">{new Date(model.createdAt).toLocaleString()}</div></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${model.isApproved ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{model.isApproved ? "approved" : "review required"}</span></div><Metrics metrics={model.metrics} />{!model.isApproved && model.status === "succeeded" && <button type="button" disabled={working} onClick={() => approve(model.id)} className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-800 disabled:opacity-50">Approve model</button>}<div className="mt-4 border-t border-slate-100 pt-3 text-sm"><div className="font-medium">Candidate validation</div><ul className="mt-2 space-y-1 text-slate-600">{evaluations.filter((evaluation) => evaluation.modelVersionId === model.id).map((evaluation) => <li key={evaluation.id}>{evaluation.selected ? "Selected: " : ""}{evaluation.algorithm.replaceAll("_", " ")} · WAPE {evaluation.metrics.wape.toFixed(2)}%</li>)}</ul></div></article>)}</div>}</section>
      </div>}
    </div>
  </main>;
}
