import type { Flow, GenerateFlowResponse, FlowRun } from "@flowos/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${options?.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

export const api = {
  generateFlow: (prompt: string, context?: string) =>
    request<GenerateFlowResponse>("/flows/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, context }),
    }),

  saveFlow: (flow: Flow) =>
    request<Flow>("/flows", {
      method: "POST",
      body: JSON.stringify({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        nodes: flow.nodes,
        edges: flow.edges,
        tags: flow.tags,
        isPublished: flow.isPublished,
        icon: flow.icon,
        category: flow.category,
      }),
    }),

  listFlows: () =>
    request<Array<{ id: string; name: string; description: string | null; tags: string[]; icon?: string | null; category?: string | null; isPublished: boolean; updatedAt: string }>>(
      "/flows",
    ),
  listApps: () => request<Array<{ id: string; name: string; description: string | null; icon?: string | null; category?: string | null }>>("/flows/apps"),

  getFlow: (id: string) => request<{ id: string; flowJson: Flow }>(`/flows/${id}`),

  deleteFlow: (id: string) => request<{ deleted: true; id: string }>(`/flows/${id}`, { method: "DELETE" }),

  runFlow: (id: string) => request<{ runId: string }>(`/flows/${id}/run`, { method: "POST" }),
  resumeRun: (runId: string, values: Record<string, unknown>) => request<{ runId: string }>(`/flows/runs/${runId}/resume`, { method: "POST", body: JSON.stringify({ values }) }),

  listRuns: (id: string) => request<FlowRun[]>(`/flows/${id}/runs`),

  generateJava: (id: string) =>
    request<{ source: string; className: string }>(`/flows/${id}/generate-java`, { method: "POST" }),
  publishedArtifact: (flowId: string, nodeId: string) => request<{ id: string; sourceCode: string; version: number } | null>(`/flows/${flowId}/artifacts/node/${nodeId}/published`),
};

export { API_URL };
