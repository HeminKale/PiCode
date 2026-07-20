import { create } from "zustand";
import type { Flow, FlowNode, FlowEdge, NodeStatus } from "@flowos/types";

interface FlowState {
  flow: Flow | null;
  selectedNodeId: string | null;
  nodeStatus: Record<string, NodeStatus>;
  nodeOutputs: Record<string, unknown>;
  runId: string | null;

  setFlow: (flow: Flow) => void;
  selectNode: (nodeId: string | null) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
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

  setRunId: (runId) => set({ runId }),

  setNodeStatus: (nodeId, status, outputs) =>
    set((state) => ({
      nodeStatus: { ...state.nodeStatus, [nodeId]: status },
      nodeOutputs: outputs !== undefined ? { ...state.nodeOutputs, [nodeId]: outputs } : state.nodeOutputs,
    })),

  resetRunState: () => set({ nodeStatus: {}, nodeOutputs: {}, runId: null }),
}));

export type { FlowNode, FlowEdge };
