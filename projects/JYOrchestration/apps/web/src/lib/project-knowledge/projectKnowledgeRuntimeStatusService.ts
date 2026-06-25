import { prisma } from "@/lib/prisma";
import { getLatestKnowledgePipelineRun } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import { getLatestKnowledgeGraphRevision } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";
import { buildProjectReferenceAssessment } from "@/lib/project-knowledge/projectKnowledgeReferenceCandidateService";
import { REFERENCE_ELIGIBILITY_USER_LABELS } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import {
  knowledgeRuntimeStatusLabel,
  resolveKnowledgeRuntimeStatus,
} from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusResolve";
import type { KnowledgeRuntimeStatusSummary } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusTypes";
import type { ReferenceEligibility } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import {
  parsePlanningKnowledgeGraphTraceV1,
  resolvePlanningKnowledgeGraphRegenerationHint,
  planningKnowledgeGraphRegenerationUserMessage,
} from "@/lib/project-graph/planningKnowledgeGraphTraceV1";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

function pickReferenceEligibilityHint(eligibility: ReferenceEligibility): string | undefined {
  switch (eligibility.level) {
    case "PARTIAL":
      return eligibility.reasons[0] ?? "승인된 기능과 흐름이 더 필요합니다.";
    case "NONE":
      return eligibility.blockingIssues[0] ?? eligibility.reasons[0];
    case "READY_FOR_SNAPSHOT":
      return eligibility.reasons[0] ?? "참조 저장본을 만들면 새 프로젝트에서 참고할 수 있습니다.";
    case "SNAPSHOT_READY":
      return eligibility.reasons[0] ?? "승인된 참조 저장본이 있어 새 프로젝트에서 참고할 수 있습니다.";
    default:
      return undefined;
  }
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

  const [nodeCount, edgeCount, pendingReviewCandidateCount, latestRun, latestRevision, referenceAssessment, projectRow, latestGraphNode] =
    await Promise.all([
      prisma.projectGraphNode.count({ where: { projectId: pid } }),
      prisma.projectGraphEdge.count({ where: { projectId: pid } }),
      prisma.projectStructureCandidate.count({
        where: { projectId: pid, lifecycleStatus: "CANDIDATE" },
      }),
      getLatestKnowledgePipelineRun(pid),
      getLatestKnowledgeGraphRevision(pid),
      buildProjectReferenceAssessment(pid),
      prisma.project.findUnique({
        where: { id: pid },
        select: { requirementsStateJson: true },
      }),
      prisma.projectGraphNode.findFirst({
        where: { projectId: pid },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

  const state = parseRequirementsStateJson(projectRow?.requirementsStateJson);
  const graphTrace = parsePlanningKnowledgeGraphTraceV1(state.planningKnowledgeGraphTraceV1);

  const referenceEligibility = referenceAssessment.eligibility;
  const pipelineStatus = latestRun?.status ?? null;

  const status = resolveKnowledgeRuntimeStatus({
    nodeCount,
    pipelineStatus,
    hasPipelineRun: latestRun != null,
    pendingReviewCandidateCount,
  });

  const lastGraphAppliedAt =
    latestGraphNode?.updatedAt?.toISOString() ??
    latestRevision?.createdAt ??
    latestRun?.completedAt ??
    latestRun?.startedAt ??
    null;

  const regenerationHint = resolvePlanningKnowledgeGraphRegenerationHint({
    trace: graphTrace,
    nodeCount,
    edgeCount,
    lastGraphAppliedAt,
  });

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
    latestChangedAt: lastGraphAppliedAt,
    pipelineStatus,
    referenceEligibilityLevel: referenceEligibility.level,
    referenceEligibilityLabel: REFERENCE_ELIGIBILITY_USER_LABELS[referenceEligibility.level],
    referenceEligibilityHint: pickReferenceEligibilityHint(referenceEligibility),
    lastPlanningGraphResetAt: graphTrace?.lastPlanningGraphResetAt ?? null,
    graphRegenerationMessage: planningKnowledgeGraphRegenerationUserMessage(regenerationHint),
    graphRegenerationHint: regenerationHint,
    ...(warnings.length ? { warnings } : {}),
  };
}
