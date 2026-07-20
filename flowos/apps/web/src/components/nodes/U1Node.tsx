import { LayerNodeBase, type LayerNodeData } from "./LayerNodeBase";
import { NodeResizer } from "@xyflow/react";
import { useFlowStore } from "@/store/flowStore";

export function U1Node({ data }: { data: LayerNodeData }) {
  const updateNodeConfig = useFlowStore((state) => state.updateNodeConfig);
  const config = data.config as { position?: { x: number; y: number; width: number; height: number } } | undefined;
  return <><NodeResizer isVisible={data.nodeType === "COMPONENT"} minWidth={120} minHeight={80} onResizeEnd={(_, params) => updateNodeConfig(data.id, { ...config, position: { ...(config?.position ?? { x: 0, y: 0 }), width: Math.round(params.width), height: Math.round(params.height) } })} /><LayerNodeBase data={data} color="#fb7185" bg="#4c0519" dim="#be123c" layerLabel="U1 · UI" /></>;
}
