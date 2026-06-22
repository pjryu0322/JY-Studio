import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildOutgoingAdjacency, findGraphPathBfs, mapPathToNodesAndEdges } from "@/lib/project-graph/projectGraphPath";

export type ProjectGraphListFilters = Readonly<{
  readonly nodeType?: string;
  readonly edgeType?: string;
  readonly limit?: number;
}>;

function parseLimit(raw: number | undefined, fallback = 200): number {
  if (!raw || !Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(500, Math.floor(raw));
}

export async function listProjectGraphNodes(projectId: string, filters?: ProjectGraphListFilters) {
  const pid = String(projectId).trim();
  const limit = parseLimit(filters?.limit);
  const nodeType = filters?.nodeType?.trim();

  return prisma.projectGraphNode.findMany({
    where: {
      projectId: pid,
      ...(nodeType ? { nodeType } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function listProjectGraphEdges(projectId: string, filters?: ProjectGraphListFilters) {
  const pid = String(projectId).trim();
  const limit = parseLimit(filters?.limit);
  const edgeType = filters?.edgeType?.trim();

  return prisma.projectGraphEdge.findMany({
    where: {
      projectId: pid,
      ...(edgeType ? { edgeType } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      fromNode: { select: { id: true, nodeType: true, title: true, entityKey: true } },
      toNode: { select: { id: true, nodeType: true, title: true, entityKey: true } },
    },
  });
}

export async function getProjectGraphSnapshot(projectId: string, filters?: ProjectGraphListFilters) {
  const [nodes, edges] = await Promise.all([
    listProjectGraphNodes(projectId, filters),
    listProjectGraphEdges(projectId, filters),
  ]);
  return { nodes, edges };
}

export async function findProjectGraphPath(
  projectId: string,
  input: Readonly<{ readonly fromNodeId: string; readonly toNodeId: string; readonly maxDepth?: number }>,
) {
  const pid = String(projectId).trim();
  const edges = await prisma.projectGraphEdge.findMany({
    where: { projectId: pid },
    select: { id: true, fromNodeId: true, toNodeId: true, edgeType: true, metadata: true, createdAt: true },
  });
  const adjacency = buildOutgoingAdjacency(edges);
  const pathIds = findGraphPathBfs(input.fromNodeId, input.toNodeId, adjacency, input.maxDepth ?? 12);
  if (!pathIds) {
    return { found: false as const, pathNodeIds: [] as string[], pathNodes: [], pathEdges: [] };
  }

  const nodes = await prisma.projectGraphNode.findMany({
    where: { projectId: pid, id: { in: pathIds } },
  });
  const fullEdges = await prisma.projectGraphEdge.findMany({ where: { projectId: pid } });
  const { pathNodes, pathEdges } = mapPathToNodesAndEdges(pathIds, nodes, fullEdges);

  return {
    found: true as const,
    pathNodeIds: pathIds,
    pathNodes,
    pathEdges,
  };
}

export type ProjectGraphNodeWhere = Prisma.ProjectGraphNodeWhereInput;
