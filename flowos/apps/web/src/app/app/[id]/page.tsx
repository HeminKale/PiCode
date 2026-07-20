"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { DisplayBundle } from "@/components/DisplayBundle";
import type { Flow } from "@flowos/types";

export default function AppLaunchPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const [flow, setFlow] = useState<Flow>();
  useEffect(() => { api.getFlow(id).then((record) => { const current = record.flowJson; if (!current.nodes.some((node) => node.type === "DISPLAY" || node.type === "COMPONENT")) { router.replace(`/flow/${id}/run`); return; } setFlow(current); }); }, [id, router]);
  useEffect(() => { if (flow?.nodes.some((node) => node.type === "DISPLAY") && !flow.nodes.some((node) => node.type === "COMPONENT")) router.replace(`/flow/${id}/run`); }, [flow, id, router]);
  if (!flow) return <main className="p-8 text-slate-400">Opening app…</main>;
  const components = flow.nodes.filter((node) => node.type === "COMPONENT");
  if (components.length) return <main className="min-h-full bg-white text-slate-950"><div className="relative mx-auto min-h-screen max-w-7xl">{components.map((node) => { const position = (node.config as { position: { x: number; y: number; width: number; height: number } }).position; const embeddedFlowId = (node.config as { embeddedFlowId: string }).embeddedFlowId; return <Embedded key={node.id} flowId={embeddedFlowId} style={{ left: position.x, top: position.y, width: position.width, height: position.height }} />; })}</div></main>;
  return <main className="p-8 text-slate-400">Opening guided app…</main>;
}

function Embedded({ flowId, style }: { flowId: string; style: React.CSSProperties }) { const [flow, setFlow] = useState<Flow>(); useEffect(() => { api.getFlow(flowId).then((record) => setFlow(record.flowJson)); }, [flowId]); const display = flow?.nodes.find((node) => node.type === "DISPLAY"); if (!display) return null; return <div className="absolute overflow-hidden" style={style}><DisplayBundle flowId={flowId} nodeId={display.id} onSubmit={() => undefined} /></div>; }
