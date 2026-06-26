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

export type AgentViewExplorerPresentation = Readonly<{
  readonly selectedNodeLabel: string;
  readonly projectedDetailNode: ProjectGraphNodeDto | null;
  readonly canvasSelectedNodeId: string | null;
  readonly canvasSelectedEdgeId: string | null;
  readonly showSelectedEdge: boolean;
  readonly agentViewReason: string | undefined;
}>;

export function buildAgentViewExplorerPresentation(input: {
  readonly graphView: ProjectKnowledgeGraphView;
  readonly visibleNodeIds: readonly string[];
  readonly visibleEdgeIds: readonly string[];
  readonly selectedNode: ProjectGraphNodeDto | null;
  readonly selectedNodeId: string | null;
  readonly detailNode: ProjectGraphNodeDto | null;
  readonly selectedEdgeId: string | null;
  readonly reasonByNodeId: Readonly<Record<string, string>>;
}): AgentViewExplorerPresentation {
  const inAgentView = input.graphView !== "all";
  const visibleNodeSet = new Set(input.visibleNodeIds);
  const visibleEdgeSet = new Set(input.visibleEdgeIds);

  const selectedNodeVisible =
    !input.selectedNode || !inAgentView || visibleNodeSet.has(input.selectedNode.id);
  const selectedNodeLabel =
    selectedNodeVisible && input.selectedNode
      ? `현재 선택: ${input.selectedNode.title}`
      : "선택된 노드 없음";

  const projectedDetailNode =
    !input.detailNode || !inAgentView || visibleNodeSet.has(input.detailNode.id)
      ? input.detailNode
      : null;

  const canvasSelectedNodeId =
    selectedNodeVisible && input.selectedNodeId ? input.selectedNodeId : null;
  const showSelectedEdge =
    Boolean(input.selectedEdgeId) &&
    (!inAgentView || (input.selectedEdgeId != null && visibleEdgeSet.has(input.selectedEdgeId)));
  const canvasSelectedEdgeId = showSelectedEdge ? input.selectedEdgeId : null;

  const agentViewReason =
    inAgentView && projectedDetailNode
      ? input.reasonByNodeId[projectedDetailNode.id]
      : undefined;

  return {
    selectedNodeLabel,
    projectedDetailNode,
    canvasSelectedNodeId,
    canvasSelectedEdgeId,
    showSelectedEdge,
    agentViewReason,
  };
}

export function computeReplayAgentViewEmpty(
  graphView: ProjectKnowledgeGraphView,
  frameNodes: readonly ProjectGraphNodeDto[],
  frameEdges: readonly ProjectGraphEdgeDto[],
): boolean {
  if (graphView === "all" || frameNodes.length === 0) return false;
  const layer = applyAgentGraphViewLayer({
    canonicalNodes: frameNodes,
    canonicalEdges: frameEdges,
    displayNodes: frameNodes,
    displayEdges: frameEdges,
    graphView,
    includeNeighborContext: true,
  });
  return layer.nodes.length === 0;
}
