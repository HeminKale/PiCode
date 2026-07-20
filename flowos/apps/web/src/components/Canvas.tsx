"use client";

import { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnReconnect,
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
import { InsertableEdge } from "./edges/InsertableEdge";

const nodeTypes = { A1: A1Node, B1: B1Node, D1: D1Node, U1: U1Node };
const edgeTypes = { default: InsertableEdge };

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
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const selectNode = useFlowStore((s) => s.selectNode);
  const updateNodePosition = useFlowStore((s) => s.updateNodePosition);
  const removeNode = useFlowStore((s) => s.removeNode);
  const reconnectEdgeAction = useFlowStore((s) => s.reconnectEdge);

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
        data: { interactive },
        reconnectable: interactive,
      })),
    [flow, nodeStatus, interactive],
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

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (!newConnection.source || !newConnection.target) return;
      reconnectEdgeAction(oldEdge.id, newConnection.source, newConnection.target);
    },
    [reconnectEdgeAction],
  );

  // Delete key removes the selected node (and its edges) - skipped while typing in a form
  // field, and React Flow's own deleteKeyCode is disabled below to avoid double-handling.
  useEffect(() => {
    if (!interactive) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (!selectedNodeId) return;
      removeNode(selectedNodeId);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interactive, selectedNodeId, removeNode]);

  if (!flow) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">No flow loaded.</div>;
  }

  return (
    <div className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={interactive ? onNodesChange : undefined}
        onNodeClick={onNodeClick}
        onReconnect={interactive ? onReconnect : undefined}
        edgesReconnectable={interactive}
        deleteKeyCode={null}
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
