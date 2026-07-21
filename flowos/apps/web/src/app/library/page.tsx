"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type FlowSummary = Awaited<ReturnType<typeof api.listFlows>>[number];

export default function LibraryPage() {
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  function refresh() {
    setLoading(true);
    api.listFlows().then(setFlows).finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    api.listFlows().then((nextFlows) => { if (active) setFlows(nextFlows); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function handleDelete(id: string) {
    await api.deleteFlow(id);
    refresh();
  }

  const filtered = flows.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="flex flex-col flex-1 bg-[#0a0a0f] text-slate-100 px-6 py-8">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Flow Library</h1>
          <Link href="/" className="text-xs text-violet-400 hover:underline">
            + New flow
          </Link>
        </div>

        <input
          className="w-full rounded-lg border border-slate-800 bg-[#13131a] px-3 py-2 text-sm mb-6 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
          placeholder="Search by name or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {loading && <p className="text-sm text-slate-500">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <p className="mb-3">No flows yet.</p>
            <Link href="/" className="text-violet-400 hover:underline text-sm">
              Describe your first process →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((f) => (
            <div key={f.id} className="rounded-lg border border-slate-800 bg-[#13131a] p-4">
              <div className="font-semibold text-sm text-slate-100">{f.name}</div>
              {f.description && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{f.description}</div>}
              <div className="flex flex-wrap gap-1 mt-2">
                {f.tags?.map((t) => (
                  <span key={t} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-slate-600 mt-2">
                Updated {new Date(f.updatedAt).toLocaleString()}
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  href={`/flow/${f.id}/canvas`}
                  className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
                >
                  Open
                </Link>
                <Link
                  href={`/flow/${f.id}/run`}
                  className="text-xs bg-sky-700 hover:bg-sky-600 px-2 py-1 rounded text-white"
                >
                  Run
                </Link>
                {f.isPublished && (
                  <Link
                    href={`/app/${f.id}`}
                    className="text-xs bg-emerald-800 hover:bg-emerald-700 px-2 py-1 rounded text-white"
                  >
                    Open Application
                  </Link>
                )}
                <button
                  onClick={() => handleDelete(f.id)}
                  className="text-xs bg-red-950 hover:bg-red-900 text-red-400 px-2 py-1 rounded ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
