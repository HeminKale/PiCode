"use client";

import { useFlowStore } from "@/store/flowStore";
import { NodeConfigForm } from "./config/NodeConfigForm";
import { ConditionEditor } from "./config/ConditionEditor";

export function ConfigPanel() {
  const flow = useFlowStore((s) => s.flow);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const nodeOutputs = useFlowStore((s) => s.nodeOutputs);
  const nodeStatus = useFlowStore((s) => s.nodeStatus);
  const updateNodeConfig = useFlowStore((s) => s.updateNodeConfig);
  const updateEdgeLabel = useFlowStore((s) => s.updateEdgeLabel);
  const removeEdge = useFlowStore((s) => s.removeEdge);
  const removeNode = useFlowStore((s) => s.removeNode);

  const node = flow?.nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return (
      <aside className="w-72 shrink-0 border-l border-slate-800 p-4 text-sm text-slate-500">
        Click a node to see its configuration.
      </aside>
    );
  }

  return (
    <aside className="w-72 shrink-0 border-l border-slate-800 p-4 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{node.layer} · {node.type}</div>
          <h3 className="text-sm font-semibold text-slate-100 mb-2">{node.label}</h3>
        </div>
        <button
          onClick={() => removeNode(node.id)}
          title="Delete node"
          className="shrink-0 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950 rounded px-1.5 py-0.5 border border-transparent hover:border-red-900"
        >
          Delete
        </button>
      </div>
      {node.metadata?.description && (
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">{node.metadata.description}</p>
      )}

      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 mt-4">Config</div>
      {node.type === "CONDITION" ? (
        <ConditionEditor
          key={node.id}
          node={node}
          edges={flow?.edges ?? []}
          updateNodeConfig={updateNodeConfig}
          updateEdgeLabel={updateEdgeLabel}
          removeEdge={removeEdge}
        />
      ) : (
        <NodeConfigForm key={node.id} node={node} updateNodeConfig={updateNodeConfig} />
      )}

      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 mt-4">Inputs / Outputs</div>
      <div className="text-xs text-slate-400">
        <div>in: {node.inputs.join(", ") || "—"}</div>
        <div>out: {node.outputs.join(", ") || "—"}</div>
      </div>

      {nodeStatus[node.id] && (
        <>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 mt-4">
            Run status: {nodeStatus[node.id]}
          </div>
          {nodeOutputs[node.id] !== undefined && (
            <pre className="text-[11px] bg-slate-900 border border-slate-800 rounded p-2 overflow-x-auto text-sky-300">
              {JSON.stringify(nodeOutputs[node.id], null, 2)}
            </pre>
          )}
        </>
      )}
    </aside>
  );
}
