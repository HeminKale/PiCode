"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Project = Awaited<ReturnType<typeof api.listAnalyticsProjects>>[number];
type UploadedVersion = Awaited<ReturnType<typeof api.uploadAnalyticsDataset>>;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 15_000;

export function AnalyticsProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState<UploadedVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  useEffect(() => {
    api.listAnalyticsProjects()
      .then((next) => { setProjects(next); setSelectedProjectId((current) => current ?? next[0]?.id ?? null); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load Analytics projects."))
      .finally(() => setLoading(false));
  }, []);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const project = await api.createAnalyticsProject(name, description || undefined);
      setProjects((current) => [project, ...current]);
      setSelectedProjectId(project.id);
      setName(""); setDescription(""); setVersion(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create Analytics project.");
    } finally { setSubmitting(false); }
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId || !file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Choose a CSV file."); return; }
    if (file.size > MAX_BYTES) { setError("CSV versions are limited to 10 MB."); return; }
    setSubmitting(true); setError(null); setVersion(null);
    try {
      const uploaded = await api.uploadAnalyticsDataset(selectedProjectId, datasetName || file.name.replace(/\.csv$/i, ""), file);
      setVersion(uploaded); setFile(null); setDatasetName("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload CSV.");
    } finally { setSubmitting(false); }
  }

  return <main className="min-h-full flex-1 bg-white px-5 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Analytics</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Projects</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Keep source data, processed datasets, models, and predictions versioned outside FlowOS flows. CSV rows are never sent to an LLM by default.</p>
      </div>

      {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_1.25fr]">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <h2 className="text-base font-semibold">New project</h2>
          <form onSubmit={createProject} className="mt-4 space-y-3">
            <label className="block text-sm font-medium">Project name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Promotion planning" /></label>
            <label className="block text-sm font-medium">Description <span className="font-normal text-slate-500">(optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Weekly sales and promotion data" /></label>
            <button disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">Create project</button>
          </form>

          <h2 className="mt-8 text-base font-semibold">Your projects</h2>
          {loading && <p className="mt-3 text-sm text-slate-500">Loading projects…</p>}
          {!loading && projects.length === 0 && <p className="mt-3 text-sm text-slate-500">Create a project to begin a dataset lifecycle.</p>}
          <div className="mt-3 space-y-2">
            {projects.map((project) => <button key={project.id} onClick={() => { setSelectedProjectId(project.id); setVersion(null); }} className={`w-full rounded-lg border p-3 text-left transition ${selectedProjectId === project.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <div className="text-sm font-semibold">{project.name}</div>
              {project.description && <div className="mt-1 text-xs text-slate-600">{project.description}</div>}
              <div className="mt-2 text-xs text-slate-400">Updated {new Date(project.updatedAt).toLocaleDateString()}</div>
            </button>)}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3"><div><h2 className="text-base font-semibold">Upload a dataset version</h2><p className="mt-1 text-sm text-slate-600">{selectedProject ? `Add an immutable CSV version to ${selectedProject.name}.` : "Select or create a project first."}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">A1 foundation</span></div>
          {selectedProject && <a href={`/analytics/projects/${selectedProject.id}/pipeline`} className="mt-4 inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">Build pipeline</a>}
          <form onSubmit={uploadCsv} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">Dataset name<input disabled={!selectedProject} required value={datasetName} onChange={(event) => setDatasetName(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-100" placeholder="Weekly sales" /></label>
            <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-medium">CSV file<input disabled={!selectedProject} type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-indigo-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700" />{file && <span className="mt-2 block font-normal text-slate-600">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}</label>
            <p className="text-xs leading-5 text-slate-500">CSV only · up to 10 MB and {MAX_ROWS.toLocaleString()} data rows per immutable version. The worker validates UTF-8, headers, and row shape before Storage accepts it.</p>
            <button disabled={!selectedProject || !file || submitting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Profiling and uploading…" : "Profile and upload CSV"}</button>
          </form>

          {version && <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-sm font-semibold text-emerald-900">Dataset version profiled and stored immutably</div><div className="mt-1 text-sm text-emerald-800">{version.fileName} · {version.profile.dataRowCount.toLocaleString()} data rows · {version.profile.columns.length} columns</div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-emerald-900"><tr><th className="pb-2 pr-4">Column</th><th className="pb-2 pr-4">Inferred type</th><th className="pb-2">Missing</th></tr></thead><tbody>{version.profile.columns.map((column) => <tr key={column.name} className="border-t border-emerald-100"><td className="py-1.5 pr-4 font-medium">{column.name}</td><td className="py-1.5 pr-4">{column.inferredType}</td><td className="py-1.5">{column.nullCount}</td></tr>)}</tbody></table></div></div>}
        </section>
      </div>
    </div>
  </main>;
}
