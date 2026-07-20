export type NodeLayer = "A1" | "B1" | "D1" | "U1";

export type NodeType =
  // A1 — Data Layer
  | "SOURCE" | "SELECT" | "CREATE" | "UPDATE" | "DELETE"
  | "JOIN" | "FILTER" | "TRANSFORM" | "AGGREGATE" | "OUTPUT"
  // B1 — Logic Layer
  | "FOR" | "CONDITION" | "ASSIGN" | "CALL_JAVA" | "NOTIFY" | "RETURN"
  // D1 — Rules Layer
  | "RULE" | "EVALUATE" | "APPROVE" | "REJECT" | "EXCEPTION" | "AUDIT_LOG"
  // U1 — UI Layer
  | "DISPLAY" | "COMPONENT";

export type NodeStatus = "idle" | "pending" | "running" | "success" | "error" | "awaiting_input";

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
  isPublished?: boolean;
  icon?: string;
  category?: string;
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
  status: "queued" | "running" | "awaiting_input" | "completed" | "failed";
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
