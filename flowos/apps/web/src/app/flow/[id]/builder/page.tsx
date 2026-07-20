"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useFlowStore } from "@/store/flowStore";
import { Canvas } from "@/components/Canvas";
import { DisplayBundle } from "@/components/DisplayBundle";
import type { Flow, FlowNode } from "@flowos/types";

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>(); const flow = useFlowStore((s) => s.flow); const setFlow = useFlowStore((s) => s.setFlow); const addNode = useFlowStore((s) => s.addNode); const [apps, setApps] = useState<Awaited<ReturnType<typeof api.listApps>>>([]);
  useEffect(() => { api.getFlow(id).then((record) => setFlow(record.flowJson)); api.listApps().then(setApps); }, [id, setFlow]);
  if (!flow) return <main className="p-8 text-slate-400">Loading page builder…</main>;
  const addComponent = (embeddedFlowId: string, name: string) => { const count = flow.nodes.filter((node) => node.type === "COMPONENT").length; const position = { x: 80 + (count % 3) * 280, y: 80 + Math.floor(count / 3) * 180 }; addNode({ id: `component-${crypto.randomUUID()}`, type: "COMPONENT", layer: "U1", label: name, config: { embeddedFlowId, position: { ...position, width: 260, height: 150 } }, inputs: [], outputs: [], position }); };
  return <main className="flex min-h-full bg-[#0a0a0f] text-slate-100"><aside className="w-64 shrink-0 border-r border-slate-800 p-4"><h1 className="font-bold">Page Builder</h1><p className="mt-1 text-xs text-slate-500">Drag published bundles onto the grid</p><div className="mt-4 space-y-2">{apps.map((app) => <button draggable key={app.id} onDragStart={(event) => event.dataTransfer.setData("application/flowos-component", JSON.stringify({ id: app.id, name: app.name }))} onClick={() => addComponent(app.id, app.name)} className="w-full rounded border border-slate-700 bg-slate-900 p-3 text-left hover:border-violet-500"><div className="font-medium text-sm">{app.icon ?? "◻"} {app.name}</div><div className="mt-1 text-xs text-slate-500">Drag or click to add</div></button>)}</div></aside><section className="relative flex-1" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const raw = event.dataTransfer.getData("application/flowos-component"); if (!raw) return; const app = JSON.parse(raw) as { id: string; name: string }; addComponent(app.id, app.name); }}><Canvas />{flow.nodes.filter((node) => node.type === "COMPONENT").map((node) => <Preview key={node.id} node={node} />)}</section></main>;
}

function Preview({ node }: { node: FlowNode }) { const [embedded, setEmbedded] = useState<Flow>(); const config = node.config as { embeddedFlowId: string; position: { width: number; height: number } }; useEffect(() => { api.getFlow(config.embeddedFlowId).then((record) => setEmbedded(record.flowJson)); }, [config.embeddedFlowId]); const display = embedded?.nodes.find((item) => item.type === "DISPLAY"); if (!display) return null; return <div className="pointer-events-none absolute overflow-hidden rounded bg-white" style={{ left: node.position.x, top: node.position.y, width: config.position.width, height: config.position.height }}><DisplayBundle flowId={embedded!.id} nodeId={display.id} onSubmit={() => undefined} /></div>; }
