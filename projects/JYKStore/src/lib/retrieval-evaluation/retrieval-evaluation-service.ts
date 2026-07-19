import { PipelineStatus, Prisma, type PipelineStepStatus } from "@prisma/client";
import { loadChunkQualitySummaryForPack } from "@/lib/chunk-quality/chunk-quality-freshness";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { prisma } from "@/lib/prisma";
import { generateRetrievalEvaluationCases } from "@/lib/retrieval-evaluation/retrieval-evaluation-case-generator";
import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";
import {
  getLatestRetrievalEvaluationRun,
  loadRetrievalEvaluationSummaryForPack,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";
import {
  aggregateRetrievalEvaluationResults,
  evaluateRetrievalCaseAgainstCandidates,
  modesForCase,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-runner";
import type {
  RetrievalEvaluationCaseInput,
  RetrievalEvaluationCaseMode,
  RetrievalEvaluationCaseResultDraft,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-types";
import { runRetrievalForEvaluation } from "@/lib/retrieval-service";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import { loadStructureQualitySummaryForPack } from "@/lib/structure-quality/structure-quality-freshness";
import { getLatestStructureCoverageReport } from "@/lib/structure-quality/structure-quality-evaluate-service";

function stepStatusFromRetrievalStatus(status: string): PipelineStepStatus {
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

function expectedMetadataJson(
  value: Record<string, unknown> | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

type PrerequisiteOk = {
  ok: true;
  packId: string;
  versionId: string;
};

type PrerequisiteError =
  | { error: "NOT_FOUND" }
  | { error: "NO_VERSION" }
  | { error: "CHUNK_QUALITY_NOT_READY"; message: string }
  | { error: "STRUCTURE_QUALITY_NOT_READY"; message: string }
  | { error: "NO_ACTIVE_CHUNKS"; message: string };

async function ensurePrerequisites(packId: string): Promise<PrerequisiteOk | PrerequisiteError> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          chunks: { where: { isActive: true }, select: { id: true } },
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

  const chunkQuality = await loadChunkQualitySummaryForPack(packId);
  if (
    chunkQuality.freshness.status !== "CURRENT" ||
    !chunkQuality.report ||
    chunkQuality.report.status === "FAIL"
  ) {
    return {
      error: "CHUNK_QUALITY_NOT_READY",
      message:
        chunkQuality.freshness.reason ??
        "청킹 품질 점검이 최신·통과 상태가 아닙니다. 재평가 후 검색 품질을 실행하세요.",
    };
  }

  const structureQuality = await loadStructureQualitySummaryForPack(packId);
  if (!structureQuality) {
    return {
      error: "STRUCTURE_QUALITY_NOT_READY",
      message: "구조/품질 점검을 먼저 실행해 주세요.",
    };
  }
  if (
    structureQuality.freshness.status !== "CURRENT" ||
    structureQuality.structureCoverage?.status === "FAIL" ||
    structureQuality.knowledgeQuality?.status === "FAIL"
  ) {
    return {
      error: "STRUCTURE_QUALITY_NOT_READY",
      message:
        structureQuality.freshness.reason ??
        "구조/품질 점검이 최신·통과 상태가 아닙니다. 재평가 후 검색 품질을 실행하세요.",
    };
  }

  if (version.chunks.length === 0) {
    return {
      error: "NO_ACTIVE_CHUNKS",
      message: "활성 chunk가 없습니다. 청킹 후 검색 품질 평가를 실행하세요.",
    };
  }

  return { ok: true, packId: pack.packId, versionId: version.id };
}

async function recordRetrievalCaseGeneratePipeline(
  packId: string,
  actorClientId: string | undefined,
) {
  const triggerType = "RETRIEVAL_EVAL_CASE_GENERATE";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: actorClientId,
      steps: [PipelineStatus.SEARCH_EVALUATING],
    });

    if (!("runId" in run)) {
      logPipelineRecordFailure("recordRetrievalCaseGeneratePipeline", {
        packId,
        triggerType,
        targetStatus: PipelineStatus.SEARCH_EVALUATING,
        error: run.error,
      });
      return;
    }

    await completePipelineStep({
      runId: run.runId,
      step: PipelineStatus.SEARCH_EVALUATING,
      status: "PASS",
      message: "검색 품질 평가 케이스 생성",
      details: { triggerType },
    });

    await finishPipelineRun({
      runId: run.runId,
      status: "PASS",
      summary: "검색 품질 평가 케이스 생성 완료",
    });

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: PipelineStatus.SEARCH_EVALUATING,
      triggeredByClientId: actorClientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordRetrievalCaseGeneratePipeline", {
        packId,
        triggerType,
        targetStatus: PipelineStatus.SEARCH_EVALUATING,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordRetrievalCaseGeneratePipeline", {
      packId,
      triggerType,
      targetStatus: PipelineStatus.SEARCH_EVALUATING,
      error,
    });
  }
}

async function recordRetrievalEvaluatePipeline(
  packId: string,
  actorClientId: string | undefined,
  retrievalStatus: string,
) {
  const triggerType = "RETRIEVAL_EVALUATE";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: actorClientId,
      steps: [PipelineStatus.SEARCH_EVALUATING],
    });

    if (!("runId" in run)) {
      logPipelineRecordFailure("recordRetrievalEvaluatePipeline", {
        packId,
        triggerType,
        targetStatus: PipelineStatus.SEARCH_EVALUATING,
        error: run.error,
      });
      return;
    }

    await completePipelineStep({
      runId: run.runId,
      step: PipelineStatus.SEARCH_EVALUATING,
      status: stepStatusFromRetrievalStatus(retrievalStatus),
      message: `검색 품질 평가: ${retrievalStatus}`,
      details: {
        status: retrievalStatus,
        retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      },
    });

    const runStatus =
      retrievalStatus === "FAIL"
        ? "FAIL"
        : retrievalStatus === "WARNING"
          ? "WARNING"
          : "PASS";

    await finishPipelineRun({
      runId: run.runId,
      status: runStatus,
      summary: `검색 품질 평가 완료 — ${retrievalStatus}`,
    });

    const nextPackStatus =
      retrievalStatus === "FAIL"
        ? PipelineStatus.SEARCH_EVALUATING
        : PipelineStatus.READY_FOR_REVIEW;

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: nextPackStatus,
      triggeredByClientId: actorClientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordRetrievalEvaluatePipeline", {
        packId,
        triggerType,
        targetStatus: nextPackStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordRetrievalEvaluatePipeline", {
      packId,
      triggerType,
      targetStatus: PipelineStatus.SEARCH_EVALUATING,
      error,
    });
  }
}

export async function generateRetrievalEvaluationCasesForPack(input: {
  packId: string;
  actorClientId?: string;
  replace?: boolean;
}): Promise<
  | { ok: true; summary: RetrievalEvaluationSummaryDto; skipped?: boolean }
  | PrerequisiteError
  | { error: "INCOMPLETE"; code: "CASES_EMPTY"; message: string }
> {
  const prereq = await ensurePrerequisites(input.packId);
  if (!("ok" in prereq)) {
    return prereq;
  }

  const existingActive = await prisma.retrievalEvaluationSet.findFirst({
    where: { packId: input.packId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      cases: { where: { isActive: true }, select: { id: true } },
    },
  });

  if (existingActive && existingActive.cases.length > 0 && !input.replace) {
    const summary = await loadRetrievalEvaluationSummaryForPack(input.packId);
    return { ok: true, summary, skipped: true };
  }

  const version = await prisma.knowledgePackVersion.findUnique({
    where: { id: prereq.versionId },
    include: {
      sourceDocuments: true,
      chunks: true,
    },
  });

  if (!version) {
    return { error: "NO_VERSION" };
  }

  const structureCoverage = await getLatestStructureCoverageReport(input.packId);
  const sourceTypeByDocId = new Map(
    version.sourceDocuments.map((d) => [d.id, d.sourceType]),
  );

  const generated = generateRetrievalEvaluationCases({
    structureSections:
      structureCoverage?.items.map((item) => ({
        sectionKey: item.sectionKey,
        title: item.title,
        required: item.required,
        covered: item.covered,
        matchedDocIds: item.matchedDocIds,
        matchedSignals: item.matchedSignals,
      })) ?? [],
    sources: version.sourceDocuments.map((doc) => ({
      id: doc.id,
      title: doc.title,
      sourceType: doc.sourceType,
      validationStatus: doc.validationStatus,
    })),
    chunks: version.chunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      section: chunk.section,
      tags: chunk.tags,
      sourceDocumentId: chunk.sourceDocumentId,
      isActive: chunk.isActive,
      sourceType: chunk.sourceDocumentId
        ? (sourceTypeByDocId.get(chunk.sourceDocumentId) ?? null)
        : null,
    })),
  });

  if (generated.length === 0) {
    return {
      error: "INCOMPLETE",
      code: "CASES_EMPTY",
      message: "생성할 검색 품질 평가 케이스가 없습니다. source/chunk를 확인하세요.",
    };
  }

  await prisma.retrievalEvaluationSet.updateMany({
    where: { packId: input.packId, status: "ACTIVE" },
    data: { status: "INACTIVE" },
  });

  await prisma.$transaction(async (tx) => {
    const set = await tx.retrievalEvaluationSet.create({
      data: {
        packId: input.packId,
        versionId: prereq.versionId,
        name: `검색 품질 평가 세트 ${new Date().toISOString().slice(0, 10)}`,
        description: "자동 생성된 검색 품질 평가 케이스",
        status: "ACTIVE",
        createdBy: input.actorClientId ?? null,
        cases: {
          create: generated.map((c) => ({
            packId: input.packId,
            versionId: prereq.versionId,
            query: c.query,
            mode: c.mode,
            topK: c.topK,
            expectedChunkIds: c.expectedChunkIds,
            expectedSourceDocumentIds: c.expectedSourceDocumentIds,
            expectedSections: c.expectedSections,
            expectedTags: c.expectedTags,
            expectedMetadata: expectedMetadataJson(c.expectedMetadata),
            weight: c.weight,
            isActive: true,
            createdBy: input.actorClientId ?? null,
          })),
        },
      },
    });
    return set;
  });

  await recordRetrievalCaseGeneratePipeline(input.packId, input.actorClientId);

  const summary = await loadRetrievalEvaluationSummaryForPack(input.packId);
  return { ok: true, summary };
}

export async function runRetrievalEvaluationForPack(input: {
  packId: string;
  actorClientId?: string;
}): Promise<
  | { ok: true; summary: RetrievalEvaluationSummaryDto }
  | PrerequisiteError
  | { error: "RETRIEVAL_EVAL_CASES_MISSING"; message: string }
> {
  const prereq = await ensurePrerequisites(input.packId);
  if (!("ok" in prereq)) {
    return prereq;
  }

  const activeSet = await prisma.retrievalEvaluationSet.findFirst({
    where: { packId: input.packId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      cases: { where: { isActive: true } },
    },
  });

  if (!activeSet || activeSet.cases.length === 0) {
    return {
      error: "RETRIEVAL_EVAL_CASES_MISSING",
      message: "활성 검색 품질 평가 케이스가 없습니다. 케이스를 먼저 생성하세요.",
    };
  }

  const caseInputs: RetrievalEvaluationCaseInput[] = activeSet.cases.map((c) => ({
    id: c.id,
    query: c.query,
    mode: c.mode as RetrievalEvaluationCaseMode,
    topK: c.topK,
    expectedChunkIds: c.expectedChunkIds,
    expectedSourceDocumentIds: c.expectedSourceDocumentIds,
    expectedSections: c.expectedSections,
    expectedTags: c.expectedTags,
    expectedMetadata: metadataRecord(c.expectedMetadata),
    weight: c.weight,
  }));

  const results: RetrievalEvaluationCaseResultDraft[] = [];

  for (const caseInput of caseInputs) {
    for (const mode of modesForCase(caseInput.mode)) {
      const candidates = await runRetrievalForEvaluation({
        knowledgePackId: input.packId,
        versionId: prereq.versionId,
        query: caseInput.query,
        retrievalMode: mode,
        topK: caseInput.topK,
      });
      results.push(
        evaluateRetrievalCaseAgainstCandidates({
          caseInput,
          retrievalMode: mode,
          candidates,
        }),
      );
    }
  }

  const aggregate = aggregateRetrievalEvaluationResults({
    cases: caseInputs,
    results,
  });

  await prisma.$transaction(async (tx) => {
    await tx.retrievalEvaluationRun.create({
      data: {
        setId: activeSet.id,
        packId: input.packId,
        versionId: prereq.versionId,
        status: aggregate.status,
        retrievalMode: aggregate.retrievalMode,
        totalCaseCount: aggregate.totalCaseCount,
        evaluatedCaseCount: aggregate.evaluatedCaseCount,
        passCaseCount: aggregate.passCaseCount,
        warningCaseCount: aggregate.warningCaseCount,
        failCaseCount: aggregate.failCaseCount,
        hitRate: aggregate.hitRate,
        meanReciprocalRank: aggregate.meanReciprocalRank,
        averageTopRank: aggregate.averageTopRank,
        averageScore: aggregate.averageScore,
        totalScore: aggregate.totalScore,
        blockingIssueCount: aggregate.blockingIssueCount,
        warningIssueCount: aggregate.warningIssueCount,
        summary: aggregate.summary,
        checkedBy: input.actorClientId ?? "SYSTEM_RULE",
        issues: {
          create: aggregate.issues.map((issue) => ({
            severity: issue.severity,
            code: issue.code,
            message: issue.message,
            field: issue.field ?? null,
            hint: issue.hint ?? null,
          })),
        },
        results: {
          create: aggregate.results.map((result) => ({
            caseId: result.caseId,
            packId: input.packId,
            versionId: prereq.versionId,
            retrievalMode: result.retrievalMode,
            query: result.query,
            status: result.status,
            topK: result.topK,
            hit: result.hit,
            firstHitRank: result.firstHitRank,
            reciprocalRank: result.reciprocalRank,
            bestScore: result.bestScore,
            matchedChunkIds: result.matchedChunkIds,
            matchedSourceIds: result.matchedSourceIds,
            returnedChunkIds: result.returnedChunkIds,
            returnedSourceIds: result.returnedSourceIds,
            issueCodes: result.issueCodes,
          })),
        },
      },
    });
  });

  await recordRetrievalEvaluatePipeline(
    input.packId,
    input.actorClientId,
    aggregate.status,
  );

  const summary = await loadRetrievalEvaluationSummaryForPack(input.packId);
  return { ok: true, summary };
}

export { getLatestRetrievalEvaluationRun, ensurePrerequisites };
