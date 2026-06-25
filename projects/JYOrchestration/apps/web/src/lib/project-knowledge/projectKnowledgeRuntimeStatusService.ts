import { prisma } from "@/lib/prisma";
import { getLatestKnowledgePipelineRun } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import { listKnowledgeGraphRevisions } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";
import { getProjectReferenceEligibility } from "@/lib/project-knowledge/projectKnowledgeReferenceCandidateService";
import { REFERENCE_ELIGIBILITY_USER_LABELS } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import {
  knowledgeRuntimeStatusLabel,
  resolveKnowledgeRuntimeStatus,
} from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusResolve";
import type { ReferenceEligibility } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";

function pickReferenceEligibilityHint(eligibility: ReferenceEligibility): string | undefined {
  if (eligibility.level === "PARTIAL") {
    return eligibility.reasons[0] ?? "승인된 기능과 흐름이 더 필요할 수 있습니다.";
  }
  if (eligibility.level === "NONE") {
    return eligibility.blockingIssues[0] ?? eligibility.reasons[0];
  }
  return undefined;
}

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

  const [nodeCount, edgeCount, pendingReviewCandidateCount, latestRun, revisions, referenceEligibility] =
    await Promise.all([
    prisma.projectGraphNode.count({ where: { projectId: pid } }),
    prisma.projectGraphEdge.count({ where: { projectId: pid } }),
    prisma.projectStructureCandidate.count({
      where: { projectId: pid, lifecycleStatus: "CANDIDATE" },
    }),
    getLatestKnowledgePipelineRun(pid),
    listKnowledgeGraphRevisions(pid, { limit: 50 }),
    getProjectReferenceEligibility(pid),
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
    referenceEligibilityLevel: referenceEligibility.level,
    referenceEligibilityLabel: REFERENCE_ELIGIBILITY_USER_LABELS[referenceEligibility.level],
    referenceEligibilityHint: pickReferenceEligibilityHint(referenceEligibility),
    ...(warnings.length ? { warnings } : {}),
  };
}
