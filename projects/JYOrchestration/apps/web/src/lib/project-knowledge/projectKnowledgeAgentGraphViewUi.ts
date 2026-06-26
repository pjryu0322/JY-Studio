import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import {
  buildAgentGraphProjection,
  getAgentGraphProjectionNodeState,
  normalizeProjectKnowledgeGraphView,
  type AgentGraphProjection,
  type ProjectKnowledgeGraphView,
} from "@/lib/project-knowledge/projectKnowledgeAgentGraphProjection";

export type AgentGraphNodeVisualState = "highlighted" | "muted";

export type AgentGraphViewLayerResult = Readonly<{
  readonly graphView: ProjectKnowledgeGraphView;
  readonly projection: AgentGraphProjection;
  readonly nodes: readonly ProjectGraphNodeDto[];
  readonly edges: readonly ProjectGraphEdgeDto[];
  readonly agentNodeVisualState: Readonly<Record<string, AgentGraphNodeVisualState>>;
}>;

export function applyAgentGraphViewLayer(input: {
  readonly canonicalNodes: readonly ProjectGraphNodeDto[];
  readonly canonicalEdges: readonly ProjectGraphEdgeDto[];
  readonly displayNodes: readonly ProjectGraphNodeDto[];
  readonly displayEdges: readonly ProjectGraphEdgeDto[];
  readonly graphView: ProjectKnowledgeGraphView;
  readonly relevanceThreshold?: number;
  readonly includeNeighborContext?: boolean;
}): AgentGraphViewLayerResult {
  const graphView = normalizeProjectKnowledgeGraphView(input.graphView);
  const projection = buildAgentGraphProjection({
    nodes: input.canonicalNodes,
    edges: input.canonicalEdges,
    view: graphView,
    relevanceThreshold: input.relevanceThreshold,
    includeNeighborContext: input.includeNeighborContext,
  });

  const visibleNodeSet = new Set(projection.visibleNodeIds);
  const visibleEdgeSet = new Set(projection.visibleEdgeIds);
  const nodes = input.displayNodes.filter((node) => visibleNodeSet.has(node.id));
  const edges = input.displayEdges.filter((edge) => visibleEdgeSet.has(edge.id));

  const agentNodeVisualState: Record<string, AgentGraphNodeVisualState> = {};
  if (graphView !== "all") {
    for (const node of nodes) {
      const state = getAgentGraphProjectionNodeState(projection, node.id);
      if (state === "highlighted" || state === "muted") {
        agentNodeVisualState[node.id] = state;
      }
    }
  }

  return { graphView, projection, nodes, edges, agentNodeVisualState };
}
