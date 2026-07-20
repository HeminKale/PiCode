import { Handle, Position } from "@xyflow/react";
import type { NodeStatus } from "@flowos/types";

export interface LayerNodeData {
  label: string;
  nodeType: string;
  layer: string;
  configSummary: string;
  status?: NodeStatus;
  [key: string]: unknown;
}

const STATUS_RING: Record<string, string> = {
  idle: "ring-0",
  pending: "ring-2 ring-amber-400 animate-pulse",
  running: "ring-2 ring-sky-400 animate-pulse",
  success: "ring-2 ring-emerald-400",
  error: "ring-2 ring-red-500",
};

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  running: "◐",
  success: "✓",
  error: "✕",
};

export function LayerNodeBase({
  data,
  color,
  bg,
  dim,
  layerLabel,
}: {
  data: LayerNodeData;
  color: string;
  bg: string;
  dim: string;
  layerLabel: string;
}) {
  const status = data.status ?? "idle";

  return (
    <div
      className={`rounded-lg border px-3 py-2 min-w-[180px] max-w-[220px] ${STATUS_RING[status] ?? ""}`}
      style={{ background: bg, borderColor: dim }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color }} />
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color }}
        >
          {layerLabel}
        </span>
        {status !== "idle" && (
          <span className="text-[11px]" style={{ color }}>
            {STATUS_ICON[status]}
          </span>
        )}
      </div>
      <div className="text-[13px] font-semibold text-slate-100">{data.nodeType}</div>
      <div className="text-[11px] text-slate-400 truncate">{data.configSummary}</div>
      <Handle type="source" position={Position.Right} style={{ background: color }} />
    </div>
  );
}
