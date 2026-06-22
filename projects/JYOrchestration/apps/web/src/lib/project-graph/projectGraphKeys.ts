import { PROJECT_GRAPH_NODE_TYPES } from "@/lib/project-graph/projectGraphTypes";

export function buildProjectEntityKey(projectId: string): string {
  return `project:${projectId}:Project`;
}

export function buildIdeaEntityKey(projectId: string): string {
  return `idea:${projectId}:Idea`;
}

export function buildRequirementEntityKey(projectId: string, sourceMessageId: string): string {
  return `requirement:${projectId}:${sourceMessageId}`;
}

export function buildFeatureEntityKey(projectId: string, featureId: string): string {
  return `feature:${projectId}:${featureId}`;
}

export function buildPrototypeEntityKey(projectId: string, prototypeId: string): string {
  return `prototype:${projectId}:${prototypeId}`;
}

export function buildReviewEntityKey(projectId: string, reviewId: string): string {
  return `review:${projectId}:${reviewId}`;
}

export function buildEventNodeProjectionKey(eventId: string, nodeType: string): string {
  return `event:${eventId}:node:${nodeType}`;
}

export function buildEventEdgeProjectionKey(eventId: string, edgeType: string, toEntityKey: string): string {
  return `event:${eventId}:edge:${edgeType}:${toEntityKey}`;
}

export function truncateGraphSummary(text: string, maxLen = 500): string {
  const s = String(text ?? "").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

export function defaultProjectNodeTitle(payload: Record<string, unknown>): string {
  const name = String(payload.name ?? "").trim();
  return name || PROJECT_GRAPH_NODE_TYPES.PROJECT;
}
