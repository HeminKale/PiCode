"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AnalyticsPredictionSummaryView } from "@flowos/analytics-contracts";

export function DisplayBundle({ flowId, nodeId, onSubmit, sourceCode, analyticsResult }: { flowId: string; nodeId: string; onSubmit: (values: Record<string, unknown>) => void; sourceCode?: string; analyticsResult?: AnalyticsPredictionSummaryView }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [publishedSource, setPublishedSource] = useState<string>();
  useEffect(() => { const receive = (event: MessageEvent) => { if (event.source !== frame.current?.contentWindow || !event.data || event.data.type !== "flowos:display-submit" || typeof event.data.values !== "object") return; onSubmit(event.data.values); }; window.addEventListener("message", receive); return () => window.removeEventListener("message", receive); }, [onSubmit]);
  useEffect(() => { if (sourceCode === undefined) api.publishedArtifact(flowId, nodeId).then((artifact) => setPublishedSource(artifact?.sourceCode ?? "<p>No published display bundle.</p>")); }, [flowId, nodeId, sourceCode]);
  const source = sourceCode ?? publishedSource ?? "";
  // This is a safe summary projection resolved by the Analytics adapter. The iframe
  // sandbox and existing submit-only postMessage contract remain unchanged.
  const analyticsBootstrap = analyticsResult ? `<script>window.__FLOWOS_ANALYTICS_RESULT__=${JSON.stringify(analyticsResult).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")};</script>` : "";
  const srcDoc = analyticsBootstrap && /<\/head>/i.test(source) ? source.replace(/<\/head>/i, `${analyticsBootstrap}</head>`) : `${analyticsBootstrap}${source}`;
  return <iframe ref={frame} title="FlowOS display" sandbox="allow-forms allow-scripts" srcDoc={srcDoc} className="h-full w-full border-0" />;
}
