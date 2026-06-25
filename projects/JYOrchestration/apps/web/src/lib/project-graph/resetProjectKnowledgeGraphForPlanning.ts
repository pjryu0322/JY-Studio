import { prisma } from "@/lib/prisma";
import { clearProjectGraphProjection } from "@/lib/project-graph/projectGraphProjection";
import { runPrismaIgnoreMissingTable } from "@/lib/prisma/prismaOptionalTableOps";
import { appendProjectEvent } from "@/lib/project-process/projectEventStore";
import { PROJECT_PROCESS_STAGES } from "@/lib/project-process/projectEventTypes";
import { runWithKnowledgeBusPublishSuppressed } from "@/lib/project-knowledge/knowledgeBusPublishContext";
import {
  PLANNING_GRAPH_RESET_EVENT_TYPE,
  buildPlanningGraphResetEventPayload,
} from "@/lib/project-graph/planningGraphResetEvent";
import type { PlanningResetCascadeReason } from "@/lib/requirements/planningResetCascadeService";

export type ProjectKnowledgeGraphResetResult = Readonly<{
  readonly deletedProjectEvents: number;
  readonly deletedProjectMessages: number;
  readonly deletedStructureCandidates: number;
  readonly deletedStructureCandidateEdges: number;
  readonly deletedGraphNodes: number;
  readonly deletedGraphEdges: number;
  readonly optionalTablesSkipped: boolean;
  readonly resetAt: string;
  readonly resetEventId: string | null;
}>;

/**
 * 기획 초기화 등 — Event Store, Structure Candidate, Graph Projection을 프로젝트 단위로 비운다.
 * 삭제 후 planning_graph_reset marker event만 기록한다(그래프 노드로 표현하지 않음).
 */
export async function resetProjectKnowledgeGraphForPlanning(
  projectId: string,
  options?: Readonly<{ readonly reason?: PlanningResetCascadeReason }>,
): Promise<ProjectKnowledgeGraphResetResult> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    throw new Error("projectId is required");
  }

  const reason = options?.reason ?? "planning_reset";
  const resetAt = new Date().toISOString();

  const graphEdges = await prisma.projectGraphEdge.deleteMany({ where: { projectId: pid } });
  const graphNodes = await prisma.projectGraphNode.deleteMany({ where: { projectId: pid } });
  await clearProjectGraphProjection(prisma, pid);

  const candidateEdges = await runPrismaIgnoreMissingTable(() =>
    prisma.projectStructureCandidateEdge.deleteMany({ where: { projectId: pid } }),
  );
  await runPrismaIgnoreMissingTable(() => prisma.projectNodeLifecycle.deleteMany({ where: { projectId: pid } }));
  await runPrismaIgnoreMissingTable(() => prisma.projectMergeHistory.deleteMany({ where: { projectId: pid } }));
  const candidates = await runPrismaIgnoreMissingTable(() =>
    prisma.projectStructureCandidate.deleteMany({ where: { projectId: pid } }),
  );

  const optionalTablesSkipped =
    candidateEdges === "missing_table" || candidates === "missing_table";

  const [events, messages] = await prisma.$transaction([
    prisma.projectEvent.deleteMany({ where: { projectId: pid } }),
    prisma.projectMessage.deleteMany({ where: { projectId: pid } }),
  ]);

  const deletedCounts = {
    deletedProjectEvents: events.count,
    deletedProjectMessages: messages.count,
    deletedStructureCandidates: candidates === "missing_table" ? 0 : candidates.count,
    deletedStructureCandidateEdges: candidateEdges === "missing_table" ? 0 : candidateEdges.count,
    deletedGraphNodes: graphNodes.count,
    deletedGraphEdges: graphEdges.count,
    optionalTablesSkipped,
  };

  const payload = buildPlanningGraphResetEventPayload({
    reason,
    resetAt,
    deletedGraphNodes: deletedCounts.deletedGraphNodes,
    deletedGraphEdges: deletedCounts.deletedGraphEdges,
    deletedProjectEvents: deletedCounts.deletedProjectEvents,
    deletedProjectMessages: deletedCounts.deletedProjectMessages,
    deletedStructureCandidates: deletedCounts.deletedStructureCandidates,
    deletedStructureCandidateEdges: deletedCounts.deletedStructureCandidateEdges,
  });

  let resetEventId: string | null = null;
  await runWithKnowledgeBusPublishSuppressed(async () => {
    const created = await appendProjectEvent(prisma, {
      projectId: pid,
      eventType: PLANNING_GRAPH_RESET_EVENT_TYPE,
      actorType: "SYSTEM",
      stage: PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
      idempotencyKey: `planning-graph-reset:${pid}:${resetAt}`,
      payload,
    });
    resetEventId = created.id;
  });

  return {
    ...deletedCounts,
    resetAt,
    resetEventId,
  };
}
