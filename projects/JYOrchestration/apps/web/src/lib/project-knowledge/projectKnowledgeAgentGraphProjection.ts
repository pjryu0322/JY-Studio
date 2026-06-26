import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import {
  DEFAULT_AGENT_RELEVANCE_THRESHOLD,
  getAgentPromptSummary,
  getAgentRelevance,
  hasAgentRelevance,
  isProjectKnowledgeAgent,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";

export type ProjectKnowledgeGraphView = "all" | ProjectKnowledgeAgent;

export type AgentGraphProjection = Readonly<{
  readonly view: ProjectKnowledgeGraphView;
  readonly agent?: ProjectKnowledgeAgent;

  readonly visibleNodeIds: readonly string[];
  readonly visibleEdgeIds: readonly string[];

  readonly highlightedNodeIds: readonly string[];
  readonly mutedNodeIds: readonly string[];

  readonly reasonByNodeId: Readonly<Record<string, string>>;
}>;

export type BuildAgentGraphProjectionInput = Readonly<{
  readonly nodes: readonly ProjectGraphNodeDto[];
  readonly edges: readonly ProjectGraphEdgeDto[];
  readonly view: ProjectKnowledgeGraphView;
  readonly relevanceThreshold?: number;
  readonly includeNeighborContext?: boolean;
}>;

export function normalizeProjectKnowledgeGraphView(value: unknown): ProjectKnowledgeGraphView {
  if (value === "all") return "all";
  if (isProjectKnowledgeAgent(value)) return value;
  return "all";
}

function uniquePreserveOrder(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function buildReasonForNode(node: ProjectGraphNodeDto, agent: ProjectKnowledgeAgent): string {
  const summary = getAgentPromptSummary(node, agent).trim();
  if (summary) return summary;
  const use = getAgentRelevance(node, agent);
  const reason = String(use?.reason ?? "").trim();
  if (reason) return reason;
  if (use) {
    return `${agent} relevance ${use.relevance}`;
  }
  return "";
}

function emptyProjection(view: ProjectKnowledgeGraphView, agent?: ProjectKnowledgeAgent): AgentGraphProjection {
  return {
    view,
    ...(agent ? { agent } : {}),
    visibleNodeIds: [],
    visibleEdgeIds: [],
    highlightedNodeIds: [],
    mutedNodeIds: [],
    reasonByNodeId: {},
  };
}

export function buildAgentGraphProjection(input: BuildAgentGraphProjectionInput): AgentGraphProjection {
  const view = normalizeProjectKnowledgeGraphView(input.view);
  const nodes = input.nodes;
  const edges = input.edges;

  if (nodes.length === 0) {
    return emptyProjection(view, view === "all" ? undefined : view);
  }

  const allNodeIds = uniquePreserveOrder(nodes.map((n) => n.id));
  const nodeById = new Map<string, ProjectGraphNodeDto>();
  for (const node of nodes) {
    if (!nodeById.has(node.id)) {
      nodeById.set(node.id, node);
    }
  }

  if (view === "all") {
    const visibleEdgeIds = uniquePreserveOrder(edges.map((e) => e.id));
    return {
      view: "all",
      visibleNodeIds: allNodeIds,
      visibleEdgeIds,
      highlightedNodeIds: [],
      mutedNodeIds: [],
      reasonByNodeId: {},
    };
  }

  const agent = view;
  const threshold = input.relevanceThreshold ?? DEFAULT_AGENT_RELEVANCE_THRESHOLD;
  const includeNeighborContext = input.includeNeighborContext !== false;

  const highlightedNodeIds: string[] = [];
  const reasonByNodeId: Record<string, string> = {};

  for (const node of nodes) {
    if (!hasAgentRelevance(node, agent, threshold)) continue;
    if (highlightedNodeIds.includes(node.id)) continue;
    highlightedNodeIds.push(node.id);
    const reason = buildReasonForNode(node, agent);
    if (reason) reasonByNodeId[node.id] = reason;
  }

  const highlightedSet = new Set(highlightedNodeIds);
  let visibleNodeIds = [...highlightedNodeIds];

  if (includeNeighborContext && highlightedSet.size > 0) {
    const neighborIds: string[] = [];
    for (const edge of edges) {
      const fromHighlighted = highlightedSet.has(edge.fromNodeId);
      const toHighlighted = highlightedSet.has(edge.toNodeId);
      if (fromHighlighted && !toHighlighted && nodeById.has(edge.toNodeId)) {
        neighborIds.push(edge.toNodeId);
      }
      if (toHighlighted && !fromHighlighted && nodeById.has(edge.fromNodeId)) {
        neighborIds.push(edge.fromNodeId);
      }
    }
    visibleNodeIds = uniquePreserveOrder([...visibleNodeIds, ...neighborIds]);
  }

  const visibleSet = new Set(visibleNodeIds);
  const mutedNodeIds = visibleNodeIds.filter((id) => !highlightedSet.has(id));

  const visibleEdgeIds: string[] = [];
  for (const edge of edges) {
    if (visibleSet.has(edge.fromNodeId) && visibleSet.has(edge.toNodeId)) {
      visibleEdgeIds.push(edge.id);
    }
  }

  return {
    view,
    agent,
    visibleNodeIds: uniquePreserveOrder(visibleNodeIds),
    visibleEdgeIds: uniquePreserveOrder(visibleEdgeIds),
    highlightedNodeIds: uniquePreserveOrder(highlightedNodeIds),
    mutedNodeIds: uniquePreserveOrder(mutedNodeIds),
    reasonByNodeId,
  };
}

export function isNodeVisibleInAgentProjection(projection: AgentGraphProjection, nodeId: string): boolean {
  return projection.visibleNodeIds.includes(nodeId);
}

export function isEdgeVisibleInAgentProjection(projection: AgentGraphProjection, edgeId: string): boolean {
  return projection.visibleEdgeIds.includes(edgeId);
}

export function getAgentGraphProjectionNodeState(
  projection: AgentGraphProjection,
  nodeId: string,
): "hidden" | "highlighted" | "muted" | "visible" {
  if (projection.view === "all") {
    return projection.visibleNodeIds.includes(nodeId) ? "visible" : "hidden";
  }
  if (projection.highlightedNodeIds.includes(nodeId)) return "highlighted";
  if (projection.mutedNodeIds.includes(nodeId)) return "muted";
  if (projection.visibleNodeIds.includes(nodeId)) return "visible";
  return "hidden";
}
