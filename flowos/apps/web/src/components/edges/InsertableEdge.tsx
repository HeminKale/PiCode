"use client";

import { useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useFlowStore } from "@/store/flowStore";
import { LAYER_COLORS, TYPES_BY_LAYER } from "@/lib/nodeDefaults";
import type { NodeLayer, NodeType } from "@flowos/types";

const LAYERS: NodeLayer[] = ["A1", "B1", "D1", "U1"];

// Custom edge for the canvas: renders the edge's label (React Flow's built-in label rendering
// only applies to its own default edge component, which this replaces), a "+" that opens a
// node-type picker to insert a node at the midpoint (Salesforce Flow Builder's inline-insert
// pattern), and a small "x" to delete the edge outright.
export function InsertableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, label, data }: EdgeProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const insertNodeOnEdge = useFlowStore((s) => s.insertNodeOnEdge);
  const removeEdge = useFlowStore((s) => s.removeEdge);
  const interactive = (data as { interactive?: boolean } | undefined)?.interactive ?? true;

  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  function pick(type: NodeType) {
    insertNodeOnEdge(id, type);
    setPickerOpen(false);
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      <EdgeLabelRenderer>
        {typeof label === "string" && label && (
          <div
            style={{ position: "absolute", transform: `translate(-50%, -100%) translate(${labelX}px,${labelY - 6}px)` }}
            className="pointer-events-none text-[10px] text-slate-300 bg-[#0a0a0f] px-1 rounded"
          >
            {label}
          </div>
        )}

        {interactive && (
          <div
            style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="nodrag nopan pointer-events-auto flex items-center gap-0.5"
          >
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              title="Insert node"
              className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-800 border border-slate-600 text-slate-300 hover:bg-violet-700 hover:border-violet-500 hover:text-white text-[10px] leading-none"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => removeEdge(id)}
              title="Delete edge"
              className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-800 border border-slate-600 text-slate-500 hover:bg-red-900 hover:border-red-600 hover:text-red-200 text-[9px] leading-none"
            >
              ✕
            </button>

            {pickerOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
                <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 w-44 rounded-md border border-slate-700 bg-[#13131a] shadow-xl p-1.5">
                  {LAYERS.map((layer) => (
                    <div key={layer} className="mb-1.5 last:mb-0">
                      <div
                        className="text-[9px] font-bold uppercase tracking-wider px-1 mb-0.5"
                        style={{ color: LAYER_COLORS[layer].color }}
                      >
                        {LAYER_COLORS[layer].label}
                      </div>
                      <div className="flex flex-col">
                        {TYPES_BY_LAYER[layer].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => pick(type)}
                            className="text-left text-[11px] text-slate-200 hover:bg-slate-800 rounded px-1.5 py-0.5"
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
