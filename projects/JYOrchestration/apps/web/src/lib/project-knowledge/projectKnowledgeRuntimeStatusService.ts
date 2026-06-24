import { prisma } from "@/lib/prisma";
import { getLatestKnowledgePipelineRun } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import { listKnowledgeGraphRevisions } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";
import {
  knowledgeRuntimeStatusLabel,
  resolveKnowledgeRuntimeStatus,
} from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusResolve";
import type { KnowledgeRuntimeStatusSummary } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusTypes";

export async function getKnowledgeRuntimeStatusSummary(
  projectId: string,
): Promise<KnowledgeRuntimeStatusSummary> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return {
      status: "PREPARING",
      statusLabel: knowledgeRuntimeStatusLabel("PREPARING"),
      nodeCount: 0,
      edgeCount: 0,
    };
  }

  const [nodeCount, edgeCount, pendingReviewCandidateCount, latestRun, revisions] = await Promise.all([
    prisma.projectGraphNode.count({ where: { projectId: pid } }),
    prisma.projectGraphEdge.count({ where: { projectId: pid } }),
    prisma.projectStructureCandidate.count({
      where: { projectId: pid, lifecycleStatus: "CANDIDATE" },
    }),
    getLatestKnowledgePipelineRun(pid),
    listKnowledgeGraphRevisions(pid, { limit: 50 }),
  ]);

  const latestRevision = revisions.length > 0 ? revisions[revisions.length - 1] : null;
  const pipelineStatus = latestRun?.status ?? null;

  const status = resolveKnowledgeRuntimeStatus({
    nodeCount,
    pipelineStatus,
    hasPipelineRun: latestRun != null,
    pendingReviewCandidateCount,
  });

  const latestChangedAt =
    latestRevision?.createdAt ?? latestRun?.completedAt ?? latestRun?.startedAt ?? null;

  const warnings: string[] = [];
  if (pipelineStatus === "FAILED" && latestRun?.steps?.length) {
    const failedStep = latestRun.steps.find((s) => !s.ok);
    if (failedStep?.title) warnings.push(failedStep.title);
  }

  return {
    status,
    statusLabel: knowledgeRuntimeStatusLabel(status),
    nodeCount,
    edgeCount,
    candidateCount: pendingReviewCandidateCount > 0 ? pendingReviewCandidateCount : undefined,
    latestChangeTitle: latestRevision?.title ?? null,
    latestChangedAt,
    pipelineStatus,
    ...(warnings.length ? { warnings } : {}),
  };
}
