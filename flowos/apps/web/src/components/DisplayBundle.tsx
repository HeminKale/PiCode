"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
export function DisplayBundle({ flowId, nodeId, onSubmit, sourceCode }: { flowId: string; nodeId: string; onSubmit: (values: Record<string, unknown>) => void; sourceCode?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [publishedSource, setPublishedSource] = useState<string>();
  useEffect(() => { const receive = (event: MessageEvent) => { if (event.source !== frame.current?.contentWindow || !event.data || event.data.type !== "flowos:display-submit" || typeof event.data.values !== "object") return; onSubmit(event.data.values); }; window.addEventListener("message", receive); return () => window.removeEventListener("message", receive); }, [onSubmit]);
  useEffect(() => { if (sourceCode === undefined) api.publishedArtifact(flowId, nodeId).then((artifact) => setPublishedSource(artifact?.sourceCode ?? "<p>No published display bundle.</p>")); }, [flowId, nodeId, sourceCode]);
  return <iframe ref={frame} title="FlowOS display" sandbox="allow-forms allow-scripts" srcDoc={sourceCode ?? publishedSource ?? ""} className="h-full w-full border-0" />;
}
