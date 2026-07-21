"use client";
/* eslint-disable react-hooks/set-state-in-effect -- route data is loaded into the shared flow store */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DisplayEditor } from "@/components/DisplayEditor";
import { api } from "@/lib/api";
import { useFlowStore } from "@/store/flowStore";

export default function DisplayEditorPage() {
  const { id, nodeId } = useParams<{ id: string; nodeId: string }>();
  const flow = useFlowStore((state) => state.flow);
  const setFlow = useFlowStore((state) => state.setFlow);
  const [loading, setLoading] = useState(!flow || flow.id !== id);
  useEffect(() => {
    if (flow?.id === id) { setLoading(false); return; }
    api.getFlow(id).then((record) => setFlow(record.flowJson)).finally(() => setLoading(false));
  }, [flow?.id, id, setFlow]);
  if (loading) return <main className="p-8 text-slate-400">Loading display editor…</main>;
  const node = flow?.nodes.find((item) => item.id === nodeId && item.type === "DISPLAY");
  if (!node) return <main className="p-8 text-slate-400">Display node not found. <Link className="text-violet-400" href={`/flow/${id}/canvas`}>Back to flow</Link></main>;
  return <DisplayEditor node={node} />;
}
