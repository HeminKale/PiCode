"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useFlowStore } from "@/store/flowStore";
import { Canvas } from "@/components/Canvas";
import { ConfigPanel } from "@/components/ConfigPanel";

export default function CanvasPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const flow = useFlowStore((s) => s.flow);
  const setFlow = useFlowStore((s) => s.setFlow);
  const updateFlowMetadata = useFlowStore((s) => s.updateFlowMetadata);

  const [loading, setLoading] = useState(!flow || flow.id !== params.id);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [downloadingJava, setDownloadingJava] = useState(false);

  useEffect(() => {
    if (flow?.id === params.id) {
      setLoading(false);
      return;
    }
    api
      .getFlow(params.id)
      .then((res) => setFlow(res.flowJson))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSave() {
    if (!flow) return;
    setSaving(true);
    try {
      await api.saveFlow(flow);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    if (!flow) return;
    await api.saveFlow(flow);
    router.push(`/flow/${flow.id}/run`);
  }

  async function handleDownloadJava() {
    if (!flow) return;
    setDownloadingJava(true);
    try {
      const { source, className } = await api.generateJava(flow.id);
      const blob = new Blob([source], { type: "text/x-java-source" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${className}.java`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingJava(false);
    }
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">Loading flow…</div>;
  }
  if (notFound || !flow) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
        <p>Flow not found.</p>
        <Link href="/" className="text-violet-400 hover:underline text-sm">
          ← Back to prompt builder
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-[#0a0a0f] text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <div>
          <div className="text-sm font-semibold">{flow.name}</div>
          <div className="text-xs text-slate-500">{flow.description}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <input aria-label="App icon" value={flow.icon ?? ""} onChange={(event) => updateFlowMetadata({ icon: event.target.value })} placeholder="Icon" className="w-14 rounded bg-slate-900 px-2 py-1" />
          <input aria-label="App category" value={flow.category ?? ""} onChange={(event) => updateFlowMetadata({ category: event.target.value })} placeholder="Category" className="w-24 rounded bg-slate-900 px-2 py-1" />
          <label className="flex items-center gap-1 text-slate-300"><input type="checkbox" checked={flow.isPublished ?? false} onChange={(event) => updateFlowMetadata({ isPublished: event.target.checked })} /> Publish</label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            className="rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-1.5"
          >
            ▶ Run
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold px-3 py-1.5"
          >
            {saved ? "✓ Saved" : saving ? "Saving…" : "💾 Save"}
          </button>
          <button
            onClick={handleDownloadJava}
            disabled={downloadingJava}
            className="rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold px-3 py-1.5"
          >
            {downloadingJava ? "Generating…" : "⤓ Download Java"}
          </button>
          <Link
            href={`/flow/${flow.id}/builder`}
            className="rounded-md border border-slate-800 hover:border-slate-600 text-slate-300 text-xs font-semibold px-3 py-1.5 flex items-center"
          >
            Open Page Builder
          </Link>
          <Link
            href={`/flow/${flow.id}/history`}
            className="rounded-md border border-slate-800 hover:border-slate-600 text-slate-300 text-xs font-semibold px-3 py-1.5 flex items-center"
          >
            History
          </Link>
          <Link
            href="/library"
            className="rounded-md border border-slate-800 hover:border-slate-600 text-slate-300 text-xs font-semibold px-3 py-1.5 flex items-center"
          >
            Library
          </Link>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Canvas />
        <ConfigPanel />
      </div>
    </div>
  );
}
