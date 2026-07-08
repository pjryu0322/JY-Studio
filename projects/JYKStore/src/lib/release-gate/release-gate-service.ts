import { AuditAction, PipelineStatus, type PipelineStepStatus } from "@prisma/client";
import type { ReleaseGateRunDto, ReleaseGateSummaryDto } from "@/lib/release-gate/release-gate-dto";
import { mapReleaseGateIssueDto } from "@/lib/release-gate/release-gate-dto";
import { computeReleaseGateFreshness } from "@/lib/release-gate/release-gate-freshness";
import { runReleaseGateEvaluation } from "@/lib/release-gate/release-gate-runner";
import type { ReleaseGateEvaluationResult } from "@/lib/release-gate/release-gate-types";
import { loadChunkQualitySummaryForPack } from "@/lib/chunk-quality/chunk-quality-freshness";
import { prisma } from "@/lib/prisma";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
} from "@/lib/pipeline-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { loadRetrievalEvaluationSummaryForPack } from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";
import { loadLatestReportsByDocumentIds } from "@/lib/source-validation/source-validation-report-service";
import { loadStructureQualitySummaryForPack } from "@/lib/structure-quality/structure-quality-freshness";

function stepStatusFromReleaseGate(status: string): PipelineStepStatus {
  if (status === "FAIL") return "FAIL";
  if (status === "WARNING") return "WARNING";
  return "PASS";
}

function mapRunToDto(run: {
  id: string;
  packId: string;
  versionId: string | null;
  targetStatus: string;
  status: string;
  blockingIssueCount: number;
  warningIssueCount: number;
  sourceStatus: string | null;
  structureStatus: string | null;
  chunkStatus: string | null;
  retrievalStatus: string | null;
  graphStatus: string | null;
  summary: string;
  checkedBy: string;
  checkedAt: Date;
  issues: {
    severity: string;
    code: string;
    message: string;
    field: string | null;
    hint: string | null;
  }[];
}): ReleaseGateRunDto {
  return {
    id: run.id,
    packId: run.packId,
    versionId: run.versionId,
    targetStatus: run.targetStatus,
    status: run.status as ReleaseGateRunDto["status"],
    blockingIssueCount: run.blockingIssueCount,
    warningIssueCount: run.warningIssueCount,
    sourceStatus: run.sourceStatus,
    structureStatus: run.structureStatus,
    chunkStatus: run.chunkStatus,
    retrievalStatus: run.retrievalStatus,
    graphStatus: run.graphStatus,
    summary: run.summary,
    checkedBy: run.checkedBy,
    checkedAt: run.checkedAt.toISOString(),
    issues: run.issues.map((issue) => ({
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      field: issue.field,
      hint: issue.hint,
    })),
  };
}

export type ReleaseGateResultDto = ReleaseGateRunDto;

async function loadReleaseGateDependencyTimestamps(packId: string, versionId: string | null) {
  const [
    structureCoverage,
    knowledgeQuality,
    chunkQuality,
    retrievalRun,
    sourceValidationMax,
  ] = await Promise.all([
    prisma.structureCoverageReport.findFirst({
      where: { packId },
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
    prisma.knowledgeQualityReport.findFirst({
      where: { packId },
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
    prisma.chunkQualityReport.findFirst({
      where: { packId },
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
    prisma.retrievalEvaluationRun.findFirst({
      where: { packId },
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
    prisma.sourceValidationReport.findFirst({
      where: { packId },
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
  ]);

  const structureTimes = [structureCoverage?.checkedAt, knowledgeQuality?.checkedAt].filter(
    Boolean,
  ) as Date[];
  const maxStructure =
    structureTimes.length > 0
      ? new Date(Math.max(...structureTimes.map((d) => d.getTime())))
      : null;

  let versionUpdatedAt: Date | null = null;
  let maxSourceDocumentUpdatedAt: Date | null = null;
  if (versionId) {
    const version = await prisma.knowledgePackVersion.findUnique({
      where: { id: versionId },
      select: {
        updatedAt: true,
        sourceDocuments: { select: { updatedAt: true } },
      },
    });
    versionUpdatedAt = version?.updatedAt ?? null;
    const sourceTimes = version?.sourceDocuments.map((d) => d.updatedAt) ?? [];
    maxSourceDocumentUpdatedAt =
      sourceTimes.length > 0
        ? new Date(Math.max(...sourceTimes.map((d) => d.getTime())))
        : null;
  }

  return {
    versionUpdatedAt,
    maxSourceDocumentUpdatedAt,
    maxSourceValidationCheckedAt: sourceValidationMax?.checkedAt ?? null,
    maxStructureQualityCheckedAt: maxStructure,
    maxChunkQualityCheckedAt: chunkQuality?.checkedAt ?? null,
    maxRetrievalEvaluationCheckedAt: retrievalRun?.checkedAt ?? null,
  };
}

export async function getLatestReleaseGateRun(
  packId: string,
): Promise<ReleaseGateRunDto | null> {
  const run = await prisma.releaseGateRun.findFirst({
    where: { packId },
    orderBy: { checkedAt: "desc" },
    include: {
      issues: { orderBy: { createdAt: "asc" } },
    },
  });
  return run ? mapRunToDto(run) : null;
}

export async function loadReleaseGateSummaryForPack(
  packId: string,
): Promise<ReleaseGateSummaryDto> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });

  const versionId = pack?.versions[0]?.id ?? null;
  const latestRun = await getLatestReleaseGateRun(packId);
  const timestamps = await loadReleaseGateDependencyTimestamps(packId, versionId);

  const freshness = computeReleaseGateFreshness({
    latestRun,
    versionId,
    ...timestamps,
  });

  return { latestRun, freshness };
}

async function persistReleaseGateRun(
  packId: string,
  evaluation: ReleaseGateEvaluationResult,
  actorClientId?: string,
): Promise<ReleaseGateRunDto> {
  const checkedBy = actorClientId?.trim() ? `CLIENT:${actorClientId.trim()}` : "SYSTEM_RULE";

  const created = await prisma.releaseGateRun.create({
    data: {
      packId,
      versionId: evaluation.versionId,
      targetStatus: evaluation.targetStatus,
      status: evaluation.status,
      blockingIssueCount: evaluation.blockingIssueCount,
      warningIssueCount: evaluation.warningIssueCount,
      sourceStatus: evaluation.sourceStatus,
      structureStatus: evaluation.structureStatus,
      chunkStatus: evaluation.chunkStatus,
      retrievalStatus: evaluation.retrievalStatus,
      graphStatus: evaluation.graphStatus,
      summary: evaluation.summary,
      checkedBy,
      issues: {
        create: evaluation.issues.map((issue) => ({
          severity: issue.severity,
          code: issue.code,
          message: issue.message,
          field: issue.field ?? null,
          hint: issue.hint ?? null,
        })),
      },
    },
    include: {
      issues: { orderBy: { createdAt: "asc" } },
    },
  });

  return mapRunToDto(created);
}

async function recordReleaseGatePipeline(
  packId: string,
  actorClientId: string | undefined,
  gateStatus: string,
) {
  const triggerType = "RELEASE_GATE_EVALUATE";
  const targetStep = PipelineStatus.RELEASE_CHECKING;
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: actorClientId,
      steps: [targetStep],
    });

    if (!("runId" in run)) {
      logPipelineRecordFailure("recordReleaseGatePipeline", {
        packId,
        triggerType,
        targetStatus: targetStep,
        error: run.error,
      });
      return;
    }

    await completePipelineStep({
      runId: run.runId,
      step: targetStep,
      status: stepStatusFromReleaseGate(gateStatus),
      message: `릴리스 게이트: ${gateStatus}`,
      details: { status: gateStatus },
    });

    const runStatus =
      gateStatus === "FAIL" ? "FAIL" : gateStatus === "WARNING" ? "WARNING" : "PASS";

    await finishPipelineRun({
      runId: run.runId,
      status: runStatus,
      summary: `릴리스 게이트 점검 — ${gateStatus}`,
    });
  } catch (error) {
    logPipelineRecordFailure("recordReleaseGatePipeline", {
      packId,
      triggerType,
      targetStatus: targetStep,
      error,
    });
  }
}

export async function evaluateReleaseGateForPack(input: {
  packId: string;
  actorClientId?: string;
  targetStatus?: "PUBLISHED" | "VERIFIED";
  persist?: boolean;
  requireReviewingStatus?: boolean;
}): Promise<{ ok: true; result: ReleaseGateRunDto } | { error: "NOT_FOUND" }> {
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sourceDocuments: true },
      },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" };
  }

  const latestVersion = pack.versions[0] ?? null;
  const versionId = latestVersion?.id ?? null;
  const sourceDocuments =
    latestVersion?.sourceDocuments.map((doc) => ({
      id: doc.id,
      title: doc.title,
      validationStatus: doc.validationStatus,
      updatedAt: doc.updatedAt.toISOString(),
    })) ?? [];

  const docIds = sourceDocuments.map((d) => d.id);
  const reportsRaw = await loadLatestReportsByDocumentIds(docIds);
  const latestReportsByDocumentId: Record<
    string,
    { status: string; checkedAt: string } | undefined
  > = {};
  for (const [id, report] of Object.entries(reportsRaw)) {
    latestReportsByDocumentId[id] = {
      status: report.status,
      checkedAt: report.checkedAt,
    };
  }

  const [structureQuality, chunkQuality, retrievalEvaluation] = await Promise.all([
    loadStructureQualitySummaryForPack(packId),
    loadChunkQualitySummaryForPack(packId),
    loadRetrievalEvaluationSummaryForPack(packId),
  ]);

  const graphNodeCount =
    versionId != null
      ? await prisma.knowledgeGraphNode.count({
          where: { packId, versionId },
        })
      : 0;

  const targetStatus = input.targetStatus ?? "PUBLISHED";
  const evaluation = runReleaseGateEvaluation({
    packStatus: pack.status,
    versionId,
    hasRequiredDescription:
      Boolean(pack.shortDescription.trim()) && Boolean(pack.description.trim()),
    sourceDocuments,
    latestReportsByDocumentId,
    structureQuality,
    chunkQuality,
    retrievalEvaluation,
    graphNodeCount,
    targetStatus,
    requireReviewingStatus: input.requireReviewingStatus,
  });

  let resultDto: ReleaseGateRunDto;

  if (input.persist) {
    resultDto = await persistReleaseGateRun(packId, evaluation, input.actorClientId);
    await recordReleaseGatePipeline(packId, input.actorClientId, evaluation.status);
    await recordProviderAudit({
      action: AuditAction.ADMIN_RELEASE_GATE_EVALUATE,
      entityType: "KnowledgePack",
      entityId: packId,
      metadata: {
        status: evaluation.status,
        targetStatus,
        blockingIssueCount: evaluation.blockingIssueCount,
        warningIssueCount: evaluation.warningIssueCount,
      },
    });
  } else {
    resultDto = {
      id: "preview",
      packId,
      versionId: evaluation.versionId,
      targetStatus: evaluation.targetStatus,
      status: evaluation.status,
      blockingIssueCount: evaluation.blockingIssueCount,
      warningIssueCount: evaluation.warningIssueCount,
      sourceStatus: evaluation.sourceStatus,
      structureStatus: evaluation.structureStatus,
      chunkStatus: evaluation.chunkStatus,
      retrievalStatus: evaluation.retrievalStatus,
      graphStatus: evaluation.graphStatus,
      summary: evaluation.summary,
      checkedBy: input.actorClientId ? `CLIENT:${input.actorClientId}` : "SYSTEM_RULE",
      checkedAt: new Date().toISOString(),
      issues: evaluation.issues.map(mapReleaseGateIssueDto),
    };
  }

  return { ok: true, result: resultDto };
}
