import { LayerNodeBase, type LayerNodeData } from "./LayerNodeBase";

export function U1Node({ data }: { data: LayerNodeData }) {
  return <LayerNodeBase data={data} color="#fb7185" bg="#4c0519" dim="#be123c" layerLabel="U1 · UI" />;
}
