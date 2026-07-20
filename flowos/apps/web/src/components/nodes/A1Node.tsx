import { LayerNodeBase, type LayerNodeData } from "./LayerNodeBase";

export function A1Node({ data }: { data: LayerNodeData }) {
  return <LayerNodeBase data={data} color="#22d3ee" bg="#083344" dim="#0e7490" layerLabel="A1 · Data" />;
}
