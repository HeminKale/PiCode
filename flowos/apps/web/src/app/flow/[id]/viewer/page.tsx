"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, API_URL } from "@/lib/api";
import type { Flow, FlowRun } from "@flowos/types";

const explain = (node: Flow["nodes"][number]) => node.metadata?.description || `${node.type.replaceAll("_", " ").toLowerCase()} step: ${node.label}.`;

export default function ViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [flow, setFlow] = useState<Flow>();
  const [runs, setRuns] = useState<FlowRun[]>([]);
  useEffect(() => { api.getFlow(id).then((value) => setFlow(value.flowJson)); api.listRuns(id).then(setRuns); }, [id]);
  if (!flow) return <main className="p-8 text-slate-400">Loading viewer…</main>;
  const latest = runs[0];
  return <main className="mx-auto w-full max-w-3xl p-8 text-slate-100"><div className="flex justify-between"><Link className="text-sm text-violet-400" href={`/flow/${id}/canvas`}>← Canvas</Link><button className="text-sm text-violet-400" onClick={() => window.location.assign(`${API_URL}/flows/${id}/viewer.pdf`)}>Download PDF</button></div><h1 className="mt-5 text-3xl font-bold">{flow.name}</h1><p className="mt-2 text-slate-400">{flow.description}</p><section className="mt-8 rounded-lg border border-slate-800 p-4"><h2 className="font-semibold">Last run</h2><p className="mt-2 text-sm text-slate-400">{latest ? `${latest.status} · ${latest.nodeLogs?.length ?? 0} logged nodes · ${latest.endedAt ?? "in progress"}` : "No runs yet."}</p></section><ol className="mt-8 space-y-3">{flow.nodes.map((node, index) => <li className="rounded-lg border border-slate-800 p-4" key={node.id}><span className="mr-3 text-xs text-violet-300">{index + 1}</span>{explain(node)}</li>)}</ol></main>;
}
