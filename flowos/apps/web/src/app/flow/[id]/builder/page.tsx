"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useFlowStore } from "@/store/flowStore";
import { DisplayBundle } from "@/components/DisplayBundle";
import type { Flow, FlowNode } from "@flowos/types";

const GRID = 20;
type Position = { x: number; y: number; width: number; height: number };
const snap = (value: number) => Math.round(value / GRID) * GRID;

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter();
  const flow = useFlowStore((state) => state.flow); const setFlow = useFlowStore((state) => state.setFlow);
  const addNode = useFlowStore((state) => state.addNode); const removeNode = useFlowStore((state) => state.removeNode);
  const updateNodeConfig = useFlowStore((state) => state.updateNodeConfig); const updateNodePosition = useFlowStore((state) => state.updateNodePosition);
  const updateFlowMetadata = useFlowStore((state) => state.updateFlowMetadata);
  const [components, setComponents] = useState<Awaited<ReturnType<typeof api.listComponentFlows>>>([]);
  const [selected, setSelected] = useState<string>(); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState<string>();
  const board = useRef<HTMLDivElement>(null); const interaction = useRef<{ id: string; mode: "move" | "resize"; startX: number; startY: number; position: Position } | undefined>(undefined);
  useEffect(() => { api.getFlow(id).then((record) => setFlow(record.flowJson)); api.listComponentFlows().then(setComponents); }, [id, setFlow]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const active = interaction.current; if (!active || !flow) return;
      const dx = snap(event.clientX - active.startX); const dy = snap(event.clientY - active.startY);
      const position = active.mode === "move" ? { ...active.position, x: Math.max(0, snap(active.position.x + dx)), y: Math.max(0, snap(active.position.y + dy)) } : { ...active.position, width: Math.max(160, snap(active.position.width + dx)), height: Math.max(100, snap(active.position.height + dy)) };
      const node = flow.nodes.find((item) => item.id === active.id); if (!node) return;
      updateNodeConfig(node.id, { ...node.config, position }); updateNodePosition(node.id, { x: position.x, y: position.y });
    };
    const end = () => { interaction.current = undefined; };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
  }, [flow, updateNodeConfig, updateNodePosition]);
  if (!flow) return <main className="p-8 text-slate-400">Loading page builder…</main>;
  const addComponent = (component: { id: string; name: string }, requested?: { x: number; y: number }) => {
    const count = flow.nodes.filter((node) => node.type === "COMPONENT").length;
    const position = { x: snap(requested?.x ?? 60 + (count % 3) * 280), y: snap(requested?.y ?? 60 + Math.floor(count / 3) * 180), width: 260, height: 160 };
    addNode({ id: `component-${crypto.randomUUID()}`, type: "COMPONENT", layer: "U1", label: component.name, config: { embeddedFlowId: component.id, position }, inputs: [], outputs: [], position: { x: position.x, y: position.y } });
  };
  const save = async (publish = false) => { setSaving(true); setNotice(undefined); try { const next = publish ? { ...flow, isPublished: true } : flow; await api.saveFlow(next); if (publish) updateFlowMetadata({ isPublished: true }); setNotice(publish ? "Page published and ready to launch." : "Page layout saved."); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save page."); } finally { setSaving(false); } };
  const startInteraction = (event: React.PointerEvent, node: FlowNode, mode: "move" | "resize") => { event.preventDefault(); event.stopPropagation(); const position = (node.config as { position?: Position }).position ?? { x: node.position.x, y: node.position.y, width: 260, height: 160 }; setSelected(node.id); interaction.current = { id: node.id, mode, startX: event.clientX, startY: event.clientY, position }; };
  return <main className="flex min-h-full bg-[#0a0a0f] text-slate-100">
    <aside className="w-72 shrink-0 border-r border-slate-800 p-4"><h1 className="font-bold">Page Builder</h1><p className="mt-1 text-xs text-slate-500">Published display bundles only. Previews are safely sandboxed and non-interactive.</p><div className="mt-4 space-y-2">{components.map((component) => <button draggable key={component.id} onDragStart={(event) => event.dataTransfer.setData("application/flowos-component", JSON.stringify(component))} onClick={() => addComponent(component)} className="w-full rounded border border-slate-700 bg-slate-900 p-3 text-left hover:border-violet-500"><div className="text-sm font-medium">{component.icon ?? "◫"} {component.name}</div><div className="mt-1 text-xs text-slate-500">Drag to place or click to add</div></button>)}{components.length === 0 && <p className="text-sm text-slate-500">Publish a flow with a display bundle to add it here.</p>}</div></aside>
    <section className="flex min-w-0 flex-1 flex-col"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3"><div><div className="font-semibold">{flow.name}</div><div className="text-xs text-slate-500">Drag components, use the corner handle to resize, and Delete to remove a selected component.</div></div><div className="flex gap-2"><button onClick={() => router.push(`/flow/${id}/canvas`)} className="rounded border border-slate-700 px-3 py-1.5 text-xs hover:border-slate-500">Back to Flow</button><button onClick={() => save()} disabled={saving} className="rounded border border-slate-700 px-3 py-1.5 text-xs hover:border-slate-500">{saving ? "Saving…" : "Save"}</button><button onClick={() => save(true)} disabled={saving} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600">Publish</button></div></header>{notice && <div className="border-b border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">{notice}</div>}
      <div ref={board} className="relative min-h-[720px] flex-1 overflow-auto bg-[linear-gradient(#1e293b_1px,transparent_1px),linear-gradient(90deg,#1e293b_1px,transparent_1px)] bg-[size:20px_20px]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const raw = event.dataTransfer.getData("application/flowos-component"); if (!raw || !board.current) return; const component = JSON.parse(raw) as { id: string; name: string }; const rect = board.current.getBoundingClientRect(); addComponent(component, { x: event.clientX - rect.left + board.current.scrollLeft, y: event.clientY - rect.top + board.current.scrollTop }); }} onPointerDown={() => setSelected(undefined)}>
        {flow.nodes.filter((node) => node.type === "COMPONENT").map((node) => <ComponentCard key={node.id} node={node} selected={selected === node.id} onMove={(event) => startInteraction(event, node, "move")} onResize={(event) => startInteraction(event, node, "resize")} onDelete={() => removeNode(node.id)} />)}
      </div>
    </section>
  </main>;
}

function ComponentCard({ node, selected, onMove, onResize, onDelete }: { node: FlowNode; selected: boolean; onMove: (event: React.PointerEvent) => void; onResize: (event: React.PointerEvent) => void; onDelete: () => void }) {
  const [embedded, setEmbedded] = useState<Flow>(); const config = node.config as { embeddedFlowId: string; position: Position };
  useEffect(() => { api.getFlow(config.embeddedFlowId).then((record) => setEmbedded(record.flowJson)); }, [config.embeddedFlowId]);
  const display = embedded?.nodes.find((item) => item.type === "DISPLAY"); const position = config.position;
  return <article className={`absolute overflow-hidden rounded border bg-white shadow-lg ${selected ? "border-violet-400 ring-2 ring-violet-500/50" : "border-slate-400"}`} style={{ left: position.x, top: position.y, width: position.width, height: position.height }}><div className="absolute inset-0 z-10 cursor-move" onPointerDown={onMove} aria-label={`Move ${node.label}`} /><div className="pointer-events-none h-full w-full">{display ? <DisplayBundle flowId={embedded!.id} nodeId={display.id} onSubmit={() => undefined} /> : <div className="p-4 text-sm text-slate-500">No published display is available.</div>}</div>{selected && <><button onPointerDown={(event) => event.stopPropagation()} onClick={onDelete} className="absolute right-1 top-1 z-20 rounded bg-red-700 px-2 py-1 text-xs text-white">Delete</button><button onPointerDown={onResize} aria-label={`Resize ${node.label}`} className="absolute bottom-0 right-0 z-20 h-5 w-5 cursor-se-resize bg-violet-600" /></>}</article>;
}
