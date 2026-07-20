"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useFlowStore } from "@/store/flowStore";

export default function Home() {
  const router = useRouter();
  const setFlow = useFlowStore((s) => s.setFlow);
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof api.listFlows>>>([]);

  useEffect(() => {
    api.listFlows().then((flows) => setRecent(flows.slice(0, 5))).catch(() => {});
  }, []);

  async function handleGenerate() {
    if (prompt.trim().length < 5) return;
    setLoading(true);
    setError(null);
    try {
      const { flow } = await api.generateFlow(prompt, context || undefined);
      setFlow(flow);
      router.push(`/flow/${flow.id}/canvas`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate flow");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-[#0a0a0f] text-slate-100">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-block text-[10px] font-bold tracking-widest uppercase text-violet-300 bg-violet-950 border border-violet-700 rounded-full px-3 py-1 mb-3">
              A1 + B1 + D1 + U1 · FlowOS
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">FlowOS</h1>
            <p className="text-slate-400 text-sm">Describe a business process. Get a working automation flow.</p>
          </div>

          <textarea
            className="w-full rounded-lg border border-slate-800 bg-[#13131a] p-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
            rows={3}
            placeholder="Process today's loan applications — get from DB, check credit score, auto-approve above 700, notify team on Slack"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-800 bg-[#13131a] p-3 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
            rows={2}
            placeholder="Optional context — table names, API docs, column names..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={loading || prompt.trim().length < 5}
            className="mt-4 w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors"
          >
            {loading ? "Generating flow…" : "Generate"}
          </button>

          {recent.length > 0 && (
            <div className="mt-10">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Recent flows</div>
              <div className="flex flex-col gap-2">
                {recent.map((f) => (
                  <Link
                    key={f.id}
                    href={`/flow/${f.id}/canvas`}
                    className="rounded-lg border border-slate-800 bg-[#13131a] px-4 py-2 text-sm hover:border-slate-600 transition-colors"
                  >
                    <div className="font-medium text-slate-100">{f.name}</div>
                    {f.description && <div className="text-xs text-slate-500 truncate">{f.description}</div>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/library" className="text-xs text-slate-500 hover:text-slate-300">
              View flow library →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
