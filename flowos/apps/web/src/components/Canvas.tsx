"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  applyNodeChanges,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useFlowStore } from "@/store/flowStore";
import { A1Node } from "./nodes/A1Node";
import { B1Node } from "./nodes/B1Node";
import { D1Node } from "./nodes/D1Node";
import { U1Node } from "./nodes/U1Node";
import type { LayerNodeData } from "./nodes/LayerNodeBase";

const nodeTypes = { A1: A1Node, B1: B1Node, D1: D1Node, U1: U1Node };

function configSummary(config: Record<string, unknown>): string {
  const entries = Object.entries(config ?? {});
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

export function Canvas({ interactive = true }: { interactive?: boolean }) {
  const flow = useFlowStore((s) => s.flow);
  const nodeStatus = useFlowStore((s) => s.nodeStatus);
  const selectNode = useFlowStore((s) => s.selectNode);
  const updateNodePosition = useFlowStore((s) => s.updateNodePosition);

  const nodes: Node<LayerNodeData>[] = useMemo(
    () =>
      (flow?.nodes ?? []).map((n) => ({
        id: n.id,
        type: n.layer,
        position: n.position,
        data: {
          label: n.label,
          nodeType: n.type,
          layer: n.layer,
          configSummary: configSummary(n.config),
          status: nodeStatus[n.id] ?? "idle",
        },
      })),
    [flow, nodeStatus],
  );

  const edges: Edge[] = useMemo(
    () =>
      (flow?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: nodeStatus[e.source] === "running" || nodeStatus[e.source] === "success",
        style: { stroke: "#475569" },
      })),
    [flow, nodeStatus],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes);
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          updateNodePosition(change.id, change.position);
        }
      }
      void next;
    },
    [nodes, updateNodePosition],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => selectNode(node.id),
    [selectNode],
  );

  if (!flow) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">No flow loaded.</div>;
  }

  return (
    <div className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={interactive ? onNodesChange : undefined}
        onNodeClick={onNodeClick}
        nodesDraggable={interactive}
        colorMode="dark"
        fitView
      >
        <Background color="#2a2a3a" gap={20} />
        <Controls />
        <MiniMap pannable zoomable style={{ background: "#13131a" }} />
      </ReactFlow>
    </div>
  );
}
