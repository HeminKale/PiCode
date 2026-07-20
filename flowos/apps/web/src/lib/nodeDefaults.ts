import type { NodeLayer, NodeType } from "@flowos/types";

export const LAYER_BY_TYPE: Record<NodeType, NodeLayer> = {
  SOURCE: "A1", SELECT: "A1", CREATE: "A1", UPDATE: "A1", DELETE: "A1",
  JOIN: "A1", FILTER: "A1", TRANSFORM: "A1", AGGREGATE: "A1", OUTPUT: "A1",
  FOR: "B1", CONDITION: "B1", ASSIGN: "B1", CALL_JAVA: "B1", NOTIFY: "B1", RETURN: "B1",
  RULE: "D1", EVALUATE: "D1", APPROVE: "D1", REJECT: "D1", EXCEPTION: "D1", AUDIT_LOG: "D1",
  DISPLAY: "U1", COMPONENT: "U1",
};

export const TYPES_BY_LAYER: Record<NodeLayer, NodeType[]> = {
  A1: ["SOURCE", "SELECT", "CREATE", "UPDATE", "DELETE", "JOIN", "FILTER", "TRANSFORM", "AGGREGATE", "OUTPUT"],
  B1: ["FOR", "CONDITION", "ASSIGN", "CALL_JAVA", "NOTIFY", "RETURN"],
  D1: ["RULE", "EVALUATE", "APPROVE", "REJECT", "EXCEPTION", "AUDIT_LOG"],
  U1: ["DISPLAY", "COMPONENT"],
};

export const LAYER_COLORS: Record<NodeLayer, { color: string; bg: string; dim: string; label: string }> = {
  A1: { color: "#22d3ee", bg: "#083344", dim: "#0e7490", label: "A1 · Data" },
  B1: { color: "#a78bfa", bg: "#2e1065", dim: "#7c3aed", label: "B1 · Logic" },
  D1: { color: "#34d399", bg: "#064e3b", dim: "#059669", label: "D1 · Rules" },
  U1: { color: "#fb7185", bg: "#4c0519", dim: "#be123c", label: "U1 · UI" },
};

export function defaultConfigForType(type: NodeType): Record<string, any> {
  switch (type) {
    case "SOURCE": return { connectorId: "" };
    case "SELECT": return { source: "", outputVar: "result" };
    case "CREATE": return { target: "", fields: {}, outputVar: "result" };
    case "UPDATE": return { target: "", where: "", fields: {} };
    case "DELETE": return { target: "", where: "" };
    case "JOIN": return { left: "", right: "", on: "", type: "inner" };
    case "FOR": return { iterateVar: "", itemVar: "item" };
    case "CONDITION": return { outcomes: [{ name: "Outcome 1", logic: "AND", conditions: [] }], defaultOutcomeName: "Default" };
    case "ASSIGN": return { assignments: [] };
    case "CALL_JAVA": return { className: "", method: "", inputVars: [], outputVar: "result" };
    case "NOTIFY": return { channel: "slack", target: "", messageTemplate: "" };
    case "RETURN": return { value: "" };
    case "RULE": return { conditions: [], logic: "AND" };
    case "AUDIT_LOG": return { event: "", dataVars: [] };
    case "DISPLAY": return { bundleId: "", fields: [] };
    case "COMPONENT": return { embeddedFlowId: "", position: { x: 0, y: 0, width: 200, height: 100 } };
    // FILTER, TRANSFORM, AGGREGATE, OUTPUT, EVALUATE, APPROVE, REJECT, EXCEPTION: shape not
    // pinned down anywhere (not in node-reference.md or generate-flow.prompt.ts) - start empty.
    default: return {};
  }
}

// When a node is inserted on an edge and the new node itself needs a labeled outgoing edge
// to behave sensibly (CONDITION/FOR both route by edge label), stub a matching label on the
// node -> target segment so the graph isn't immediately invalid.
export function defaultOutgoingLabelForType(type: NodeType, config: Record<string, any>): string | undefined {
  if (type === "CONDITION") return config.outcomes?.[0]?.name;
  if (type === "FOR") return "For Each";
  return undefined;
}

export function labelForType(type: NodeType): string {
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
}
