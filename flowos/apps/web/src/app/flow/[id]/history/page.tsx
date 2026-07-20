"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { FlowRun, NodeStatus } from "@flowos/types";

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-950 text-emerald-400",
  failed: "bg-red-950 text-red-400",
  running: "bg-sky-950 text-sky-400",
  queued: "bg-slate-800 text-slate-400",
};

const NODE_STATUS_STYLE: Record<NodeStatus, string> = {
  idle: "text-slate-500",
  pending: "text-slate-500",
  running: "text-amber-400",
  success: "text-emerald-400",
  error: "text-red-400",
  awaiting_input: "text-violet-400",
};

function duration(run: FlowRun): string {
  if (!run.endedAt) return "—";
  const ms = new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function HistoryPage() {
  const params = useParams<{ id: string }>();
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    api.listRuns(params.id).then(setRuns).finally(() => setLoading(false));
  }, [params.id]);

  return (
    <div className="flex flex-col flex-1 bg-[#0a0a0f] text-slate-100 px-6 py-8">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Run History</h1>
          <div className="flex gap-3">
            <Link href={`/flow/${params.id}/run`} className="text-xs text-violet-400 hover:underline">
              ▶ New run
            </Link>
            <Link href={`/flow/${params.id}/canvas`} className="text-xs text-slate-400 hover:text-slate-200">
              ← Canvas
            </Link>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}

        {!loading && runs.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <p className="mb-3">No runs yet.</p>
            <Link href={`/flow/${params.id}/run`} className="text-violet-400 hover:underline text-sm">
              Start the first run →
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {runs.map((run) => {
            const expanded = expandedRunId === run.id;
            return (
              <div key={run.id} className="rounded-lg border border-slate-800 bg-[#13131a]">
                <button
                  onClick={() => setExpandedRunId(expanded ? null : run.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[run.status] ?? "bg-slate-800 text-slate-400"}`}>
                      {run.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{run.id}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{new Date(run.startedAt).toLocaleString()}</span>
                    <span>{duration(run)}</span>
                    <span>{run.nodeLogs?.length ?? 0} nodes</span>
                    <span className="text-slate-600">{expanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-800 px-4 py-3 flex flex-col gap-2">
                    {(run.nodeLogs ?? []).map((log, i) => (
                      <div key={i} className="text-[11px] font-mono">
                        <div className="flex gap-2 items-center">
                          <span className={NODE_STATUS_STYLE[log.status]}>●</span>
                          <span className="text-slate-300">{log.nodeId}</span>
                          <span className={NODE_STATUS_STYLE[log.status]}>{log.status}</span>
                          {log.durationMs !== undefined && <span className="text-slate-600">{log.durationMs}ms</span>}
                        </div>
                        {log.error && <div className="text-red-400 pl-5 mt-0.5">{log.error}</div>}
                        {log.outputs !== undefined && Object.keys(log.outputs).length > 0 && (
                          <pre className="text-slate-500 pl-5 mt-0.5 overflow-x-auto">{JSON.stringify(log.outputs, null, 2)}</pre>
                        )}
                      </div>
                    ))}
                    {(run.nodeLogs ?? []).length === 0 && <div className="text-xs text-slate-600">No node logs recorded for this run.</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
