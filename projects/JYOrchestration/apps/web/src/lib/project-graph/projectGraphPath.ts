import type { ProjectGraphEdge, ProjectGraphNode } from "@prisma/client";

export type GraphAdjacency = Readonly<Map<string, readonly string[]>>;

export function buildOutgoingAdjacency(edges: readonly Pick<ProjectGraphEdge, "fromNodeId" | "toNodeId">[]): GraphAdjacency {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    const list = map.get(e.fromNodeId) ?? [];
    list.push(e.toNodeId);
    map.set(e.fromNodeId, list);
  }
  return map;
}

export function findGraphPathBfs(
  fromNodeId: string,
  toNodeId: string,
  adjacency: GraphAdjacency,
  maxDepth = 12,
): string[] | null {
  const start = String(fromNodeId).trim();
  const goal = String(toNodeId).trim();
  if (!start || !goal) return null;
  if (start === goal) return [start];

  const queue: { id: string; path: string[] }[] = [{ id: start, path: [start] }];
  const visited = new Set<string>([start]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.path.length > maxDepth) continue;

    const nextIds = adjacency.get(current.id) ?? [];
    for (const nextId of nextIds) {
      if (visited.has(nextId)) continue;
      const path = [...current.path, nextId];
      if (nextId === goal) return path;
      visited.add(nextId);
      queue.push({ id: nextId, path });
    }
  }

  return null;
}

export function mapPathToNodesAndEdges(
  pathNodeIds: readonly string[],
  nodes: readonly ProjectGraphNode[],
  edges: readonly ProjectGraphEdge[],
): {
  readonly pathNodes: ProjectGraphNode[];
  readonly pathEdges: ProjectGraphEdge[];
} {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const pathNodes = pathNodeIds.map((id) => nodeById.get(id)).filter((n): n is ProjectGraphNode => Boolean(n));

  const pathEdges: ProjectGraphEdge[] = [];
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const from = pathNodeIds[i];
    const to = pathNodeIds[i + 1];
    const edge = edges.find((e) => e.fromNodeId === from && e.toNodeId === to);
    if (edge) pathEdges.push(edge);
  }

  return { pathNodes, pathEdges };
}
