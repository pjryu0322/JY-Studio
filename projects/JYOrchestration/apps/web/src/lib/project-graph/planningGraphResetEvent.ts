import type { PlanningResetCascadeReason } from "@/lib/requirements/planningResetCascadeService";

export const PLANNING_GRAPH_RESET_EVENT_TYPE = "planning_graph_reset" as const;

export type PlanningGraphResetEventPayload = Readonly<{
  readonly eventType: typeof PLANNING_GRAPH_RESET_EVENT_TYPE;
  readonly reason: PlanningResetCascadeReason;
  readonly resetAt: string;
  readonly deletedGraphNodes: number;
  readonly deletedGraphEdges: number;
  readonly deletedProjectEvents: number;
  readonly deletedProjectMessages: number;
  readonly deletedStructureCandidates: number;
  readonly deletedStructureCandidateEdges: number;
  readonly deletedKnowledgeGraphRevisions?: number;
  readonly deletedKnowledgePipelineRuns?: number;
}>;

export function buildPlanningGraphResetEventPayload(input: Readonly<{
  readonly reason: PlanningResetCascadeReason;
  readonly resetAt: string;
  readonly deletedGraphNodes: number;
  readonly deletedGraphEdges: number;
  readonly deletedProjectEvents: number;
  readonly deletedProjectMessages: number;
  readonly deletedStructureCandidates: number;
  readonly deletedStructureCandidateEdges: number;
  readonly deletedKnowledgeGraphRevisions?: number;
  readonly deletedKnowledgePipelineRuns?: number;
}>): PlanningGraphResetEventPayload {
  return {
    eventType: PLANNING_GRAPH_RESET_EVENT_TYPE,
    reason: input.reason,
    resetAt: input.resetAt,
    deletedGraphNodes: input.deletedGraphNodes,
    deletedGraphEdges: input.deletedGraphEdges,
    deletedProjectEvents: input.deletedProjectEvents,
    deletedProjectMessages: input.deletedProjectMessages,
    deletedStructureCandidates: input.deletedStructureCandidates,
    deletedStructureCandidateEdges: input.deletedStructureCandidateEdges,
    deletedKnowledgeGraphRevisions: input.deletedKnowledgeGraphRevisions,
    deletedKnowledgePipelineRuns: input.deletedKnowledgePipelineRuns,
  };
}

export function formatPlanningGraphResetActivityLine(payload: PlanningGraphResetEventPayload): string {
  return `기획 초기화로 Knowledge Graph를 초기화했습니다. 삭제된 노드 ${payload.deletedGraphNodes}개 · 삭제된 연결 ${payload.deletedGraphEdges}개`;
}

export function parsePlanningGraphResetEventPayload(raw: unknown): PlanningGraphResetEventPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (String(o.eventType ?? "") !== PLANNING_GRAPH_RESET_EVENT_TYPE) return null;
  const reason = String(o.reason ?? "").trim();
  if (reason !== "planning_reset" && reason !== "planning_regenerated" && reason !== "manual") {
    return null;
  }
  return {
    eventType: PLANNING_GRAPH_RESET_EVENT_TYPE,
    reason,
    resetAt: String(o.resetAt ?? ""),
    deletedGraphNodes: Number(o.deletedGraphNodes) || 0,
    deletedGraphEdges: Number(o.deletedGraphEdges) || 0,
    deletedProjectEvents: Number(o.deletedProjectEvents) || 0,
    deletedProjectMessages: Number(o.deletedProjectMessages) || 0,
    deletedStructureCandidates: Number(o.deletedStructureCandidates) || 0,
    deletedStructureCandidateEdges: Number(o.deletedStructureCandidateEdges) || 0,
    ...(o.deletedKnowledgeGraphRevisions != null
      ? { deletedKnowledgeGraphRevisions: Number(o.deletedKnowledgeGraphRevisions) || 0 }
      : {}),
    ...(o.deletedKnowledgePipelineRuns != null
      ? { deletedKnowledgePipelineRuns: Number(o.deletedKnowledgePipelineRuns) || 0 }
      : {}),
  };
}

/** @deprecated use PLANNING_GRAPH_RESET_EVENT_TYPE */
export const PLANNING_GRAPH_RESET_PROJECT_EVENT_TYPE = PLANNING_GRAPH_RESET_EVENT_TYPE;
