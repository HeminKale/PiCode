import type { FlowNode, FlowEdge } from "@flowos/types";

/** Kahn's algorithm — returns nodes ordered so every edge's source comes before its target. */
export function topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !inDegree.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const ordered: FlowNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeById.get(id);
    if (node) ordered.push(node);

    for (const nextId of adjacency.get(id) ?? []) {
      inDegree.set(nextId, (inDegree.get(nextId) ?? 0) - 1);
      if (inDegree.get(nextId) === 0) queue.push(nextId);
    }
  }

  // Any nodes not reached (disconnected, or a cycle) — append in original order as a fallback
  if (ordered.length < nodes.length) {
    const seen = new Set(ordered.map((n) => n.id));
    for (const node of nodes) if (!seen.has(node.id)) ordered.push(node);
  }

  return ordered;
}
