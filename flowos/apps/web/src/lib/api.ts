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
      }),
    }),

  listFlows: () =>
    request<Array<{ id: string; name: string; description: string | null; tags: string[]; updatedAt: string }>>(
      "/flows",
    ),

  getFlow: (id: string) => request<{ id: string; flowJson: Flow }>(`/flows/${id}`),

  deleteFlow: (id: string) => request<{ deleted: true; id: string }>(`/flows/${id}`, { method: "DELETE" }),

  runFlow: (id: string) => request<{ runId: string }>(`/flows/${id}/run`, { method: "POST" }),

  listRuns: (id: string) => request<FlowRun[]>(`/flows/${id}/runs`),
};

export { API_URL };
