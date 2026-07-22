"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { DisplayBundle } from "@/components/DisplayBundle";
import type { Flow } from "@flowos/types";
import type { AnalyticsPredictionSummaryView, AnalyticsResultReference } from "@flowos/analytics-contracts";

const EMBEDDED_FLOW_WAIT_TIMEOUT_MS = 30_000;
const EMBEDDED_FLOW_POLL_INTERVAL_MS = 250;

export default function AppLaunchPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const [flow, setFlow] = useState<Flow>(); const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { api.getFlow(id).then((record) => { if (!record.isPublished) { setUnavailable(true); return; } const current = record.flowJson; if (!current.nodes.some((node) => node.type === "DISPLAY" || node.type === "COMPONENT")) { router.replace(`/flow/${id}/run`); return; } setFlow(current); }).catch(() => setUnavailable(true)); }, [id, router]);
  useEffect(() => { if (flow?.nodes.some((node) => node.type === "DISPLAY") && !flow.nodes.some((node) => node.type === "COMPONENT")) router.replace(`/flow/${id}/run`); }, [flow, id, router]);
  if (unavailable) return <main className="p-8 text-slate-500">This application is not available.</main>;
  if (!flow) return <main className="p-8 text-slate-400">Opening app…</main>;
  const components = flow.nodes.filter((node) => node.type === "COMPONENT");
  if (components.length) return <main className="min-h-full bg-white text-slate-950"><div className="relative mx-auto min-h-screen max-w-7xl">{components.map((node) => { const config = node.config as { position: { x: number; y: number; width: number; height: number }; embeddedFlowId: string; analyticsResultRef?: AnalyticsResultReference }; return <Embedded key={node.id} flowId={config.embeddedFlowId} analyticsResultRef={config.analyticsResultRef} style={{ left: config.position.x, top: config.position.y, width: config.position.width, height: config.position.height }} />; })}</div></main>;
  return <main className="p-8 text-slate-400">Opening guided app…</main>;
}

function Embedded({ flowId, style, analyticsResultRef }: { flowId: string; style: React.CSSProperties; analyticsResultRef?: AnalyticsResultReference }) {
  const [flow, setFlow] = useState<Flow>(); const [runId, setRunId] = useState<string>(); const [message, setMessage] = useState<string>(); const [analyticsResult, setAnalyticsResult] = useState<AnalyticsPredictionSummaryView>();
  useEffect(() => { api.getFlow(flowId).then((record) => setFlow(record.flowJson)); }, [flowId]);
  const display = flow?.nodes.find((node) => node.type === "DISPLAY");
  const displayReference = display?.config.analyticsResultRef as AnalyticsResultReference | undefined;
  useEffect(() => { const reference = analyticsResultRef ?? displayReference; if (!reference) { setAnalyticsResult(undefined); return; } api.resolveAnalyticsResultReference(reference).then(setAnalyticsResult).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Analytics result is unavailable.")); }, [analyticsResultRef, displayReference]);
  const submit = async (values: Record<string, unknown>) => {
    setMessage(undefined);
    try {
      let activeRunId = runId;
      if (activeRunId) {
        const current = await api.getRun(activeRunId);
        if (current.status !== "awaiting_input") activeRunId = undefined;
      }
      if (!activeRunId) {
        activeRunId = (await api.runFlow(flowId)).runId;
        setRunId(activeRunId);
        // Starting an embedded flow uses the existing pausable engine. Wait for its
        // DISPLAY node to reach awaiting_input before submitting the iframe's values.
        const waitStartedAt = Date.now();
        while (Date.now() - waitStartedAt < EMBEDDED_FLOW_WAIT_TIMEOUT_MS) {
          const current = await api.getRun(activeRunId);
          if (current.status === "awaiting_input") break;
          if (current.status === "failed" || current.status === "completed") throw new Error("The embedded flow did not wait for display input.");
          await new Promise((resolve) => window.setTimeout(resolve, EMBEDDED_FLOW_POLL_INTERVAL_MS));
        }
      }
      const waiting = await api.getRun(activeRunId);
      if (waiting.status !== "awaiting_input") throw new Error("The embedded flow did not reach its display step within 30 seconds.");
      await api.resumeRun(activeRunId, values);
      setMessage("Submitted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit this form."); }
  };
  if (!display) return null;
  return <div className="absolute overflow-hidden" style={style}><DisplayBundle flowId={flowId} nodeId={display.id} onSubmit={submit} analyticsResult={analyticsResult} />{message && <div className="absolute bottom-0 left-0 right-0 bg-white/95 p-1 text-center text-xs text-slate-600">{message}</div>}</div>;
}
