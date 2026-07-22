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
  listAnalyticsProjects: () =>
    request<Array<{ id: string; workspaceId: string; name: string; description?: string | null; createdAt: string; updatedAt: string }>>("/analytics/projects", { headers: analyticsHeaders() }),
  createAnalyticsProject: (name: string, description?: string) =>
    request<{ id: string; workspaceId: string; name: string; description?: string | null; createdAt: string; updatedAt: string }>("/analytics/projects", {
      method: "POST", headers: analyticsHeaders(), body: JSON.stringify({ name, description }),
    }),
  uploadAnalyticsDataset: async (projectId: string, datasetName: string, file: File) => {
    const form = new FormData();
    form.set("datasetName", datasetName);
    form.set("file", file);
    const response = await fetch(`${API_URL}/analytics/projects/${projectId}/datasets`, { method: "POST", headers: analyticsHeaders(), body: form });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`CSV upload failed (${response.status}): ${body}`);
    }
    return response.json() as Promise<{
      id: string; fileName: string; byteSize: number; status: "profiled"; profile: { dataRowCount: number; columns: Array<{ name: string; inferredType: string; nullCount: number }> };
    }>;
  },
  listAnalyticsDatasetVersions: (projectId: string) =>
    request<Array<{ id: string; datasetId: string; fileName: string; status: "profiled" | "processed"; profile?: { dataRowCount: number; columns: Array<{ name: string }> } }>>(`/analytics/projects/${projectId}/dataset-versions`, { headers: analyticsHeaders() }),
  listAnalyticsPipelines: (projectId: string) =>
    request<Array<{ id: string; templateId: string; version: number; isApproved: boolean; definition: AnalyticsPipelineDefinition }>>(`/analytics/projects/${projectId}/pipelines`, { headers: analyticsHeaders() }),
  createAnalyticsPipeline: (projectId: string, input: { name: string; description?: string; definition: AnalyticsPipelineDefinition; isApproved: boolean }) =>
    request<{ id: string; version: number; isApproved: boolean; definition: AnalyticsPipelineDefinition }>(`/analytics/projects/${projectId}/pipelines`, { method: "POST", headers: analyticsHeaders(), body: JSON.stringify(input) }),
  listAnalyticsPipelineRuns: (projectId: string) =>
    request<Array<{ id: string; status: string; outputDatasetVersionId?: string | null; errorSummary?: string | null; createdAt: string }>>(`/analytics/projects/${projectId}/pipeline-runs`, { headers: analyticsHeaders() }),
  listAnalyticsQualityReports: (projectId: string) =>
    request<Array<{ pipelineRunId: string; createdAt: string; report: { inputRowCount: number; outputRowCount: number; findings: Array<{ code: string; severity: string; column?: string; count?: number; message: string }> } }>>(`/analytics/projects/${projectId}/quality-reports`, { headers: analyticsHeaders() }),
  runAnalyticsPipeline: (projectId: string, pipelineVersionId: string, input: { sources: Array<{ sourceId: string; datasetVersionId: string }>; outputDatasetName?: string }) =>
    request<{ id: string; status: string }>(`/analytics/projects/${projectId}/pipelines/${pipelineVersionId}/runs`, { method: "POST", headers: analyticsHeaders(), body: JSON.stringify(input) }),
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
  listComponentFlows: () => request<Array<{ id: string; name: string; description: string | null; icon?: string | null; category?: string | null }>>("/flows/components"),

  getFlow: (id: string) => request<{ id: string; flowJson: Flow; isPublished: boolean }>(`/flows/${id}`),

  deleteFlow: (id: string) => request<{ deleted: true; id: string }>(`/flows/${id}`, { method: "DELETE" }),

  runFlow: (id: string) => request<{ runId: string }>(`/flows/${id}/run`, { method: "POST" }),
  getRun: (runId: string) => request<FlowRun>(`/flows/runs/${runId}`),
  resumeRun: (runId: string, values: Record<string, unknown>) => request<{ runId: string }>(`/flows/runs/${runId}/resume`, { method: "POST", body: JSON.stringify({ values }) }),

  listRuns: (id: string) => request<FlowRun[]>(`/flows/${id}/runs`),

  generateJava: (id: string) =>
    request<{ source: string; className: string }>(`/flows/${id}/generate-java`, { method: "POST" }),
  listArtifacts: (flowId: string) => request<Array<{ id: string; nodeId: string; kind: string; version: number; sourceCode: string; status: string; isPublished: boolean; createdAt: string }>>(`/flows/${flowId}/artifacts`),
  createArtifactDraft: (flowId: string, nodeId: string, sourceCode: string) => request<{ id: string; version: number; sourceCode: string; isPublished: boolean }>(`/flows/${flowId}/artifacts`, { method: "POST", body: JSON.stringify({ nodeId, kind: "display", sourceCode }) }),
  generateDisplayDraft: (flowId: string, nodeId: string, prompt: string) => request<{ id: string; version: number; sourceCode: string; isPublished: boolean }>(`/flows/${flowId}/artifacts/generate-display`, { method: "POST", body: JSON.stringify({ nodeId, prompt }) }),
  publishArtifact: (flowId: string, artifactId: string) => request<{ id: string; version: number; isPublished: boolean }>(`/flows/${flowId}/artifacts/${artifactId}/publish`, { method: "POST" }),
  publishedArtifact: (flowId: string, nodeId: string) => request<{ id: string; sourceCode: string; version: number } | null>(`/flows/${flowId}/artifacts/node/${nodeId}/published`),
};

export type AnalyticsPipelineDefinition = {
  contractVersion: "analytics.v1";
  id: string;
  projectId: string;
  version: number;
  nodes: Array<{ id: string; type: string; inputIds: string[]; config: Record<string, unknown> }>;
  columnMappings: Array<{ sourceColumn: string; canonicalColumn: string; transformation?: "none" | "normalize_0_1" }>;
};

function analyticsHeaders(): HeadersInit {
  return { "x-workspace-id": process.env.NEXT_PUBLIC_ANALYTICS_WORKSPACE_ID ?? "default-workspace" };
}

export { API_URL };
