import { PipelineStatus, type PipelineStepStatus } from "@prisma/client";
import type { ChunkQualityReportDto } from "@/lib/chunk-quality/chunk-quality-dto";
import { runChunkQuality } from "@/lib/chunk-quality/chunk-quality-runner";
import { loadStructureQualitySummaryForPack } from "@/lib/structure-quality/structure-quality-freshness";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { prisma } from "@/lib/prisma";

function stepStatusFromChunkStatus(status: string): PipelineStepStatus {
  if (status === "FAIL") return "FAIL";
  if (status === "WARNING") return "WARNING";
  return "PASS";
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function mapChunkQualityReport(report: {
  id: string;
  packId: string;
  versionId: string;
  status: string;
  totalScore: number;
  coverageScore: number;
  traceabilityScore: number;
  sizeScore: number;
  duplicateScore: number;
  metadataScore: number;
  structureAlignmentScore: number;
  activeChunkCount: number;
  inactiveChunkCount: number;
  sourceDocumentCount: number;
  coveredSourceDocumentCount: number;
  orphanChunkCount: number;
  missingSourceChunkCount: number;
  shortChunkCount: number;
  longChunkCount: number;
  duplicateChunkCount: number;
  chunkWithoutMetadataCount: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  summary: string;
  checkedAt: Date;
  issues: {
    severity: string;
    code: string;
    message: string;
    field: string | null;
    hint: string | null;
  }[];
  metrics: {
    chunkId: string | null;
    sourceDocumentId: string | null;
    title: string | null;
    contentLength: number;
    tokenEstimate: number;
    status: string;
    score: number;
    issues: string[];
  }[];
}): ChunkQualityReportDto {
  return {
    id: report.id,
    packId: report.packId,
    versionId: report.versionId,
    status: report.status,
    totalScore: report.totalScore,
    coverageScore: report.coverageScore,
    traceabilityScore: report.traceabilityScore,
    sizeScore: report.sizeScore,
    duplicateScore: report.duplicateScore,
    metadataScore: report.metadataScore,
    structureAlignmentScore: report.structureAlignmentScore,
    activeChunkCount: report.activeChunkCount,
    inactiveChunkCount: report.inactiveChunkCount,
    sourceDocumentCount: report.sourceDocumentCount,
    coveredSourceDocumentCount: report.coveredSourceDocumentCount,
    orphanChunkCount: report.orphanChunkCount,
    missingSourceChunkCount: report.missingSourceChunkCount,
    shortChunkCount: report.shortChunkCount,
    longChunkCount: report.longChunkCount,
    duplicateChunkCount: report.duplicateChunkCount,
    chunkWithoutMetadataCount: report.chunkWithoutMetadataCount,
    blockingIssueCount: report.blockingIssueCount,
    warningIssueCount: report.warningIssueCount,
    summary: report.summary,
    checkedAt: report.checkedAt.toISOString(),
    issues: report.issues.map((issue) => ({
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      field: issue.field,
      hint: issue.hint,
    })),
    metrics: report.metrics.map((metric) => ({
      chunkId: metric.chunkId,
      sourceDocumentId: metric.sourceDocumentId,
      title: metric.title,
      contentLength: metric.contentLength,
      tokenEstimate: metric.tokenEstimate,
      status: metric.status,
      score: metric.score,
      issues: metric.issues,
    })),
  };
}

export async function getLatestChunkQualityReport(
  packId: string,
): Promise<ChunkQualityReportDto | null> {
  const report = await prisma.chunkQualityReport.findFirst({
    where: { packId },
    orderBy: { checkedAt: "desc" },
    include: {
      issues: { orderBy: { createdAt: "asc" } },
      metrics: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!report) return null;
  return mapChunkQualityReport(report);
}

async function recordChunkQualityPipeline(
  packId: string,
  actorClientId: string | undefined,
  chunkStatus: string,
) {
  const triggerType = "CHUNK_QUALITY_EVALUATE";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: actorClientId,
      steps: [PipelineStatus.CHUNK_EVALUATING],
    });

    if (!("runId" in run)) {
      logPipelineRecordFailure("recordChunkQualityPipeline", {
        packId,
        triggerType,
        targetStatus: PipelineStatus.CHUNK_EVALUATING,
        error: run.error,
      });
      return;
    }

    await completePipelineStep({
      runId: run.runId,
      step: PipelineStatus.CHUNK_EVALUATING,
      status: stepStatusFromChunkStatus(chunkStatus),
      message: `청킹 품질 평가: ${chunkStatus}`,
      details: { status: chunkStatus },
    });

    const runStatus =
      chunkStatus === "FAIL" ? "FAIL" : chunkStatus === "WARNING" ? "WARNING" : "PASS";

    await finishPipelineRun({
      runId: run.runId,
      status: runStatus,
      summary: `청킹 품질 평가 완료 — ${chunkStatus}`,
    });

    const nextPackStatus =
      chunkStatus === "FAIL" ? PipelineStatus.CHUNK_EVALUATING : PipelineStatus.INDEXING;

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: nextPackStatus,
      triggeredByClientId: actorClientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordChunkQualityPipeline", {
        packId,
        triggerType,
        targetStatus: nextPackStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordChunkQualityPipeline", {
      packId,
      triggerType,
      targetStatus: PipelineStatus.CHUNK_EVALUATING,
      error,
    });
  }
}

export async function evaluatePackChunkQuality(input: {
  packId: string;
  actorClientId?: string;
}): Promise<
  | { ok: true; report: ChunkQualityReportDto }
  | { error: "NOT_FOUND" }
  | { error: "NO_VERSION" }
  | { error: "STRUCTURE_QUALITY_NOT_CURRENT"; message: string }
> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sourceDocuments: true,
          chunks: true,
        },
      },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" };
  }

  const version = pack.versions[0];
  if (!version) {
    return { error: "NO_VERSION" };
  }

  const structureQuality = await loadStructureQualitySummaryForPack(pack.packId);
  if (!structureQuality) {
    return {
      error: "STRUCTURE_QUALITY_NOT_CURRENT",
      message: "구조/품질 점검을 먼저 실행해 주세요.",
    };
  }
  if (structureQuality.freshness.status !== "CURRENT") {
    return {
      error: "STRUCTURE_QUALITY_NOT_CURRENT",
      message:
        structureQuality.freshness.reason ??
        "구조/품질 점검이 최신 상태가 아닙니다. 재평가 후 청킹 품질을 실행하세요.",
    };
  }
  if (
    structureQuality.structureCoverage?.status === "FAIL" ||
    structureQuality.knowledgeQuality?.status === "FAIL"
  ) {
    return {
      error: "STRUCTURE_QUALITY_NOT_CURRENT",
      message: "구조/품질 점검이 FAIL이면 청킹 품질 평가를 실행할 수 없습니다.",
    };
  }

  const structureSections =
    structureQuality.structureCoverage?.items.map((item) => ({
      sectionKey: item.sectionKey,
      title: item.title,
      required: item.required,
      covered: item.covered,
      matchedDocIds: item.matchedDocIds,
      matchedSignals: item.matchedSignals,
    })) ?? [];

  const result = runChunkQuality({
    sources: version.sourceDocuments.map((doc) => ({
      id: doc.id,
      sourceType: doc.sourceType,
      validationStatus: doc.validationStatus,
      content: doc.content,
    })),
    chunks: version.chunks.map((chunk) => ({
      id: chunk.id,
      sourceDocumentId: chunk.sourceDocumentId,
      chunkType: chunk.chunkType,
      title: chunk.title,
      content: chunk.content,
      section: chunk.section,
      tags: chunk.tags,
      metadata: metadataRecord(chunk.metadata),
      isActive: chunk.isActive,
    })),
    structureSections,
  });

  const created = await prisma.$transaction(async (tx) => {
    const report = await tx.chunkQualityReport.create({
      data: {
        packId: pack.packId,
        versionId: version.id,
        status: result.status,
        totalScore: result.totalScore,
        coverageScore: result.coverageScore,
        traceabilityScore: result.traceabilityScore,
        sizeScore: result.sizeScore,
        duplicateScore: result.duplicateScore,
        metadataScore: result.metadataScore,
        structureAlignmentScore: result.structureAlignmentScore,
        activeChunkCount: result.activeChunkCount,
        inactiveChunkCount: result.inactiveChunkCount,
        sourceDocumentCount: result.sourceDocumentCount,
        coveredSourceDocumentCount: result.coveredSourceDocumentCount,
        orphanChunkCount: result.orphanChunkCount,
        missingSourceChunkCount: result.missingSourceChunkCount,
        shortChunkCount: result.shortChunkCount,
        longChunkCount: result.longChunkCount,
        duplicateChunkCount: result.duplicateChunkCount,
        chunkWithoutMetadataCount: result.chunkWithoutMetadataCount,
        blockingIssueCount: result.blockingIssueCount,
        warningIssueCount: result.warningIssueCount,
        summary: result.summary,
        issues: {
          create: result.issues.map((issue) => ({
            severity: issue.severity,
            code: issue.code,
            message: issue.message,
            field: issue.field ?? null,
            hint: issue.hint ?? null,
          })),
        },
        metrics: {
          create: result.metrics.map((metric) => ({
            chunkId: metric.chunkId,
            sourceDocumentId: metric.sourceDocumentId,
            title: metric.title,
            contentLength: metric.contentLength,
            tokenEstimate: metric.tokenEstimate,
            status: metric.status,
            score: metric.score,
            issues: metric.issues,
          })),
        },
      },
      include: {
        issues: true,
        metrics: true,
      },
    });
    return report;
  });

  await recordChunkQualityPipeline(pack.packId, input.actorClientId, result.status);

  return {
    ok: true,
    report: mapChunkQualityReport(created),
  };
}
