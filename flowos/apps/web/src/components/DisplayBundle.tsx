"use client";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
export function DisplayBundle({ flowId, nodeId, onSubmit }: { flowId: string; nodeId: string; onSubmit: (values: Record<string, unknown>) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => { const receive = (event: MessageEvent) => { if (event.source !== frame.current?.contentWindow || !event.data || event.data.type !== "flowos:display-submit" || typeof event.data.values !== "object") return; onSubmit(event.data.values); }; window.addEventListener("message", receive); return () => window.removeEventListener("message", receive); }, [onSubmit]);
  useEffect(() => { api.publishedArtifact(flowId, nodeId).then((artifact) => { if (frame.current) frame.current.srcdoc = artifact?.sourceCode ?? "<p>No published display bundle.</p>"; }); }, [flowId, nodeId]);
  return <iframe ref={frame} title="FlowOS display" sandbox="allow-forms allow-scripts" className="h-full w-full border-0" />;
}
