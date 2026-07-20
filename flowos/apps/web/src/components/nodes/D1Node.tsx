import { LayerNodeBase, type LayerNodeData } from "./LayerNodeBase";

export function D1Node({ data }: { data: LayerNodeData }) {
  return <LayerNodeBase data={data} color="#34d399" bg="#064e3b" dim="#059669" layerLabel="D1 · Rules" />;
}
