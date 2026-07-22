"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useFlowStore } from "@/store/flowStore";
import { Canvas } from "@/components/Canvas";
import { DisplayBundle } from "@/components/DisplayBundle";
import type { NodeStatus } from "@flowos/types";
import type { AnalyticsPredictionSummaryView, AnalyticsResultReference } from "@flowos/analytics-contracts";

interface LogEntry {
  nodeId: string;
  status: NodeStatus;
  outputs?: unknown;
  at: string;
}

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const flow = useFlowStore((s) => s.flow);
  const setFlow = useFlowStore((s) => s.setFlow);
  const setNodeStatus = useFlowStore((s) => s.setNodeStatus);
  const resetRunState = useFlowStore((s) => s.resetRunState);

  const [loading, setLoading] = useState(!flow || flow.id !== params.id);
  const [runStatus, setRunStatus] = useState<"starting" | "running" | "awaiting_input" | "completed" | "failed">("starting");
  const [runId, setRunId] = useState<string>();
  const [displayNodeId, setDisplayNodeId] = useState<string>();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [analyticsResult, setAnalyticsResult] = useState<AnalyticsPredictionSummaryView>();
  const started = useRef(false);

  useEffect(() => {
    if (flow?.id === params.id) {
      setLoading(false);
      return;
    }
    api
      .getFlow(params.id)
      .then((res) => setFlow(res.flowJson))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (loading || !flow || started.current) return;
    started.current = true;
    resetRunState();
    setLog([]);

    const socket = getSocket();

    api.runFlow(flow.id).then(({ runId }) => {
      socket.emit("join_run", { runId });
      setRunId(runId);
      setRunStatus("running");
    });

    const onNodeStatus = (payload: { nodeId: string; status: NodeStatus; outputs?: unknown; error?: string }) => {
      setNodeStatus(payload.nodeId, payload.status, payload.outputs);
      if (payload.status === "awaiting_input") { setRunStatus("awaiting_input"); setDisplayNodeId(payload.nodeId); }
      setLog((prev) => [...prev, { nodeId: payload.nodeId, status: payload.status, outputs: payload.outputs, at: new Date().toLocaleTimeString() }]);
    };
    const onComplete = () => setRunStatus("completed");
    const onError = () => setRunStatus("failed");

    socket.on("node:status", onNodeStatus);
    socket.on("run:complete", onComplete);
    socket.on("run:error", onError);

    return () => {
      socket.off("node:status", onNodeStatus);
      socket.off("run:complete", onComplete);
      socket.off("run:error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, flow]);

  useEffect(() => {
    const display = flow?.nodes.find((node) => node.type === "DISPLAY");
    const reference = display?.config.analyticsResultRef as AnalyticsResultReference | undefined;
    if (!reference) { setAnalyticsResult(undefined); return; }
    api.resolveAnalyticsResultReference(reference).then(setAnalyticsResult).catch(() => setAnalyticsResult(undefined));
  }, [flow]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">Loading flow…</div>;
  }
  if (!flow) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
        <p>Flow not found.</p>
        <Link href="/" className="text-violet-400 hover:underline text-sm">← Back</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-[#0a0a0f] text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <div className="text-sm font-semibold">{flow.name}</div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded ${
              runStatus === "completed"
                ? "bg-emerald-950 text-emerald-400"
                : runStatus === "failed"
                  ? "bg-red-950 text-red-400"
                  : "bg-sky-950 text-sky-400"
            }`}
          >
            {runStatus}
          </span>
          <Link href={`/flow/${flow.id}/canvas`} className="text-xs text-slate-400 hover:text-slate-200">
            ← Canvas
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Canvas interactive={false} />
      </div>

      {runStatus === "awaiting_input" && runId && displayNodeId && (
        <div className="h-80 border-t border-slate-800 bg-white">
          <DisplayBundle flowId={flow.id} nodeId={displayNodeId} analyticsResult={analyticsResult} onSubmit={async (values) => { await api.resumeRun(runId, values); setRunStatus("running"); setDisplayNodeId(undefined); }} />
        </div>
      )}

      <div className="h-40 border-t border-slate-800 overflow-y-auto px-4 py-2 bg-[#0d0d13]">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Execution log</div>
        {log.length === 0 && <div className="text-xs text-slate-600">Waiting for run to start…</div>}
        {log.map((entry, i) => (
          <div key={i} className="text-[11px] text-slate-300 flex gap-2 py-0.5 font-mono">
            <span className="text-slate-600">{entry.at}</span>
            <span className="text-slate-500">{entry.nodeId}</span>
            <span
              className={
                entry.status === "success"
                  ? "text-emerald-400"
                  : entry.status === "error"
                    ? "text-red-400"
                    : "text-amber-400"
              }
            >
              {entry.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
