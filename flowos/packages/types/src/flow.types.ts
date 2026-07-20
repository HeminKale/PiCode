export type NodeLayer = "A1" | "B1" | "D1";

export type NodeType =
  // A1 — Data Layer
  | "SELECT" | "JOIN" | "FILTER" | "TRANSFORM" | "AGGREGATE" | "OUTPUT"
  // B1 — Logic Layer
  | "FOR" | "CONDITION" | "CALL_JAVA" | "UPDATE" | "NOTIFY" | "RETURN"
  // D1 — Rules Layer
  | "RULE" | "EVALUATE" | "APPROVE" | "REJECT" | "EXCEPTION" | "AUDIT_LOG";

export type NodeStatus = "idle" | "pending" | "running" | "success" | "error";

export interface FlowNode {
  id: string;
  type: NodeType;
  layer: NodeLayer;
  label: string;
  config: Record<string, any>;
  inputs: string[];
  outputs: string[];
  position: { x: number; y: number };
  metadata?: {
    description?: string;
    isCustomJava?: boolean;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface FlowVariable {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "connector";
  defaultValue?: any;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables?: FlowVariable[];
  tags?: string[];
}

export interface NodeLog {
  nodeId: string;
  status: NodeStatus;
  startedAt: string;
  endedAt?: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  error?: string;
  durationMs?: number;
}

export interface FlowRun {
  id: string;
  flowId: string;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string;
  endedAt?: string;
  inputs: Record<string, any>;
  nodeLogs: NodeLog[];
}

export interface GenerateFlowRequest {
  prompt: string;
  context?: string;
}

export interface GenerateFlowResponse {
  flow: Flow;
  reasoning: string;
}
