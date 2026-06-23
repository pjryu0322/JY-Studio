import { prisma } from "@/lib/prisma";
import { clearProjectGraphProjection } from "@/lib/project-graph/projectGraphProjection";
import { runPrismaIgnoreMissingTable } from "@/lib/prisma/prismaOptionalTableOps";

export type ProjectKnowledgeGraphResetResult = Readonly<{
  readonly deletedProjectEvents: number;
  readonly deletedProjectMessages: number;
  readonly deletedStructureCandidates: number;
  readonly deletedStructureCandidateEdges: number;
  readonly deletedGraphNodes: number;
  readonly deletedGraphEdges: number;
  readonly optionalTablesSkipped: boolean;
}>;

/**
 * 기획 초기화 등 — Event Store, Structure Candidate, Graph Projection을 프로젝트 단위로 비운다.
 */
export async function resetProjectKnowledgeGraphForPlanning(
  projectId: string,
): Promise<ProjectKnowledgeGraphResetResult> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    throw new Error("projectId is required");
  }

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

  return {
    deletedProjectEvents: events.count,
    deletedProjectMessages: messages.count,
    deletedStructureCandidates: candidates === "missing_table" ? 0 : candidates.count,
    deletedStructureCandidateEdges: candidateEdges === "missing_table" ? 0 : candidateEdges.count,
    deletedGraphNodes: graphNodes.count,
    deletedGraphEdges: graphEdges.count,
    optionalTablesSkipped,
  };
}
