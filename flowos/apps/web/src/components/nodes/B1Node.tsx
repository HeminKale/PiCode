import { LayerNodeBase, type LayerNodeData } from "./LayerNodeBase";

export function B1Node({ data }: { data: LayerNodeData }) {
  return <LayerNodeBase data={data} color="#a78bfa" bg="#2e1065" dim="#7c3aed" layerLabel="B1 · Logic" />;
}
