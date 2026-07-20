import { create } from "zustand";
import type { Flow, FlowNode, FlowEdge, NodeStatus, NodeType } from "@flowos/types";
import { LAYER_BY_TYPE, defaultConfigForType, defaultOutgoingLabelForType, labelForType } from "@/lib/nodeDefaults";

function genId(prefix: string): string {
  const rand = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}-${rand.slice(0, 8)}`;
}

interface FlowState {
  flow: Flow | null;
  selectedNodeId: string | null;
  nodeStatus: Record<string, NodeStatus>;
  nodeOutputs: Record<string, unknown>;
  runId: string | null;

  setFlow: (flow: Flow) => void;
  selectNode: (nodeId: string | null) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, any>) => void;
  addNode: (node: FlowNode) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: FlowEdge) => void;
  removeEdge: (edgeId: string) => void;
  updateEdgeLabel: (edgeId: string, label: string | undefined) => void;
  reconnectEdge: (edgeId: string, source: string, target: string) => void;
  insertNodeOnEdge: (edgeId: string, nodeType: NodeType) => void;
  setRunId: (runId: string | null) => void;
  setNodeStatus: (nodeId: string, status: NodeStatus, outputs?: unknown) => void;
  resetRunState: () => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  flow: null,
  selectedNodeId: null,
  nodeStatus: {},
  nodeOutputs: {},
  runId: null,

  setFlow: (flow) => set({ flow, nodeStatus: {}, nodeOutputs: {}, runId: null, selectedNodeId: null }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  updateNodePosition: (nodeId, position) => {
    const flow = get().flow;
    if (!flow) return;
    set({
      flow: {
        ...flow,
        nodes: flow.nodes.map((n: FlowNode) => (n.id === nodeId ? { ...n, position } : n)),
      },
    });
  },

  updateNodeConfig: (nodeId, config) => {
    const flow = get().flow;
    if (!flow) return;
    set({
      flow: { ...flow, nodes: flow.nodes.map((n: FlowNode) => (n.id === nodeId ? { ...n, config } : n)) },
    });
  },

  addNode: (node) => {
    const flow = get().flow;
    if (!flow) return;
    set({ flow: { ...flow, nodes: [...flow.nodes, node] } });
  },

  removeNode: (nodeId) => {
    const flow = get().flow;
    if (!flow) return;
    set({
      flow: {
        ...flow,
        nodes: flow.nodes.filter((n: FlowNode) => n.id !== nodeId),
        edges: flow.edges.filter((e: FlowEdge) => e.source !== nodeId && e.target !== nodeId),
      },
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    });
  },

  addEdge: (edge) => {
    const flow = get().flow;
    if (!flow) return;
    set({ flow: { ...flow, edges: [...flow.edges, edge] } });
  },

  removeEdge: (edgeId) => {
    const flow = get().flow;
    if (!flow) return;
    set({ flow: { ...flow, edges: flow.edges.filter((e: FlowEdge) => e.id !== edgeId) } });
  },

  updateEdgeLabel: (edgeId, label) => {
    const flow = get().flow;
    if (!flow) return;
    set({ flow: { ...flow, edges: flow.edges.map((e: FlowEdge) => (e.id === edgeId ? { ...e, label } : e)) } });
  },

  reconnectEdge: (edgeId, source, target) => {
    const flow = get().flow;
    if (!flow) return;
    set({
      flow: { ...flow, edges: flow.edges.map((e: FlowEdge) => (e.id === edgeId ? { ...e, source, target } : e)) },
    });
  },

  // Splits `edgeId` in two around a freshly-created node of `nodeType`, placed at the
  // midpoint of the edge's source/target nodes. The original edge's label (e.g. a CONDITION
  // outcome name) is kept on the source -> newNode segment, since that's the segment leaving
  // the original source node and is what the CONDITION-outcome/edge-label invariant checks
  // against. The newNode -> target segment gets no label, unless the inserted node type itself
  // needs one to be structurally valid (CONDITION/FOR), in which case it's stubbed to match.
  insertNodeOnEdge: (edgeId, nodeType) => {
    const flow = get().flow;
    if (!flow) return;
    const edge = flow.edges.find((e: FlowEdge) => e.id === edgeId);
    if (!edge) return;
    const sourceNode = flow.nodes.find((n: FlowNode) => n.id === edge.source);
    const targetNode = flow.nodes.find((n: FlowNode) => n.id === edge.target);
    const position =
      sourceNode && targetNode
        ? { x: (sourceNode.position.x + targetNode.position.x) / 2, y: (sourceNode.position.y + targetNode.position.y) / 2 }
        : { x: 0, y: 0 };

    const config = defaultConfigForType(nodeType);
    const newNode: FlowNode = {
      id: genId("n"),
      type: nodeType,
      layer: LAYER_BY_TYPE[nodeType],
      label: labelForType(nodeType),
      config,
      inputs: [],
      outputs: [],
      position,
    };

    const edge1: FlowEdge = { id: genId(`${edge.id}-a`), source: edge.source, target: newNode.id, label: edge.label };
    const edge2: FlowEdge = {
      id: genId(`${edge.id}-b`),
      source: newNode.id,
      target: edge.target,
      label: defaultOutgoingLabelForType(nodeType, config),
    };

    set({
      flow: {
        ...flow,
        nodes: [...flow.nodes, newNode],
        edges: [...flow.edges.filter((e: FlowEdge) => e.id !== edgeId), edge1, edge2],
      },
    });
  },

  setRunId: (runId) => set({ runId }),

  setNodeStatus: (nodeId, status, outputs) =>
    set((state) => ({
      nodeStatus: { ...state.nodeStatus, [nodeId]: status },
      nodeOutputs: outputs !== undefined ? { ...state.nodeOutputs, [nodeId]: outputs } : state.nodeOutputs,
    })),

  resetRunState: () => set({ nodeStatus: {}, nodeOutputs: {}, runId: null }),
}));

export type { FlowNode, FlowEdge };
