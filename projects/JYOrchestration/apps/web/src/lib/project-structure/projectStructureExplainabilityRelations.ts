import type { ProjectGraphEdge, ProjectGraphNode } from "@prisma/client";
import type { StructureExplainabilityRelatedNode } from "@/lib/project-structure/structureExplainabilityModel";

export function collectRelatedNodesForGraphNode(
  nodeId: string,
  edges: readonly Pick<ProjectGraphEdge, "fromNodeId" | "toNodeId" | "edgeType">[],
  nodeById: ReadonlyMap<string, Pick<ProjectGraphNode, "id" | "nodeType" | "title">>,
): StructureExplainabilityRelatedNode[] {
  const out: StructureExplainabilityRelatedNode[] = [];
  const nid = String(nodeId).trim();
  for (const e of edges) {
    if (e.toNodeId === nid) {
      const from = nodeById.get(e.fromNodeId);
      if (from) {
        out.push({
          nodeId: from.id,
          nodeType: from.nodeType,
          title: from.title,
          edgeType: e.edgeType,
          direction: "IN",
        });
      }
    }
    if (e.fromNodeId === nid) {
      const to = nodeById.get(e.toNodeId);
      if (to) {
        out.push({
          nodeId: to.id,
          nodeType: to.nodeType,
          title: to.title,
          edgeType: e.edgeType,
          direction: "OUT",
        });
      }
    }
  }
  return out;
}
