import { regenerateAutoChunksForPack } from "@/lib/auto-pipeline/provider-auto-chunk-service";
import { evaluatePackChunkQuality } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import { prisma } from "@/lib/prisma";
import {
  evaluateRetrievalEvaluationPreflight,
  type RetrievalEvaluationPreflightResult,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-preflight";
import {
  generateRetrievalEvaluationCasesForPack,
  runRetrievalEvaluationForPack,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-service";
import { evaluatePackStructureQuality } from "@/lib/structure-quality/structure-quality-evaluate-service";

export type QualityPipelineStatus = "PASS" | "WARNING" | "FAIL" | "SKIPPED";

export type ProviderReviewPreparationResult = {
  ok: true;
  generatedChunkCount: number;
  structureQualityStatus: QualityPipelineStatus;
  chunkQualityStatus: QualityPipelineStatus;
  retrievalCaseCount: number;
  retrievalEvaluationStatus: QualityPipelineStatus;
  preflight?: RetrievalEvaluationPreflightResult | null;
  warnings: string[];
};

function asQualityStatus(status: string | null | undefined): QualityPipelineStatus {
  if (status === "PASS" || status === "WARNING" || status === "FAIL") return status;
  return "FAIL";
}

export async function loadRetrievalEvaluationPreflightForPack(
  packId: string,
): Promise<RetrievalEvaluationPreflightResult> {
  const pack = await prisma.knowledgePack.findFirst({
    where: { packId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          chunks: {
            where: { isActive: true },
            select: { id: true, sourceDocumentId: true },
          },
        },
      },
    },
  });

  const activeChunks = pack?.versions[0]?.chunks ?? [];
  const activeSet = await prisma.retrievalEvaluationSet.findFirst({
    where: { packId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      cases: {
        where: { isActive: true },
        select: {
          query: true,
          expectedChunkIds: true,
          expectedSourceDocumentIds: true,
        },
      },
    },
  });

  return evaluateRetrievalEvaluationPreflight({
    activeChunkCount: activeChunks.length,
    activeChunkIds: activeChunks.map((c) => c.id),
    activeChunkSourceDocumentIds: activeChunks
      .map((c) => c.sourceDocumentId)
      .filter((id): id is string => Boolean(id)),
    activeCases: (activeSet?.cases ?? []).map((c) => ({
      query: c.query,
      expectedChunkIds: c.expectedChunkIds,
      expectedSourceDocumentIds: c.expectedSourceDocumentIds,
    })),
  });
}

export async function runProviderReviewPreparationPipeline(input: {
  packId: string;
  actorClientId?: string;
  replaceAutoChunks?: boolean;
  runRetrievalEvaluation?: boolean;
  repairRetrievalData?: boolean;
}): Promise<ProviderReviewPreparationResult> {
  const warnings: string[] = [];
  const packId = input.packId.trim();
  const replaceAutoChunks = input.replaceAutoChunks !== false;
  const runRetrievalEvaluation = input.runRetrievalEvaluation !== false;
  const repairRetrievalData = input.repairRetrievalData === true;

  let structureQualityStatus: QualityPipelineStatus = "SKIPPED";
  let chunkQualityStatus: QualityPipelineStatus = "SKIPPED";
  let retrievalEvaluationStatus: QualityPipelineStatus = "SKIPPED";
  let generatedChunkCount = 0;
  let retrievalCaseCount = 0;
  let preflight: RetrievalEvaluationPreflightResult | null = null;

  const structure = await evaluatePackStructureQuality({
    packId,
    actorClientId: input.actorClientId,
  });

  if ("error" in structure) {
    structureQualityStatus = "FAIL";
    warnings.push(
      structure.error === "NO_VERSION"
        ? "버전이 없어 구조/품질 점검을 실행하지 못했습니다."
        : "구조/품질 점검을 실행하지 못했습니다.",
    );
  } else {
    const coverage = structure.structureCoverage.status;
    const quality = structure.knowledgeQuality.status;
    if (coverage === "FAIL" || quality === "FAIL") {
      structureQualityStatus = "FAIL";
    } else if (coverage === "WARNING" || quality === "WARNING") {
      structureQualityStatus = "WARNING";
    } else {
      structureQualityStatus = "PASS";
    }
  }

  const chunks = await regenerateAutoChunksForPack({
    packId,
    actorClientId: input.actorClientId,
    mode: "hybrid",
    replace: replaceAutoChunks,
    reinforce: true,
  });

  if ("error" in chunks) {
    warnings.push(chunks.message);
  } else {
    generatedChunkCount = chunks.createdChunkCount;
    warnings.push(...chunks.warnings);
  }

  if (structureQualityStatus === "FAIL") {
    warnings.push("구조/품질 점검이 기준에 미달해 청킹·검색 품질 점검을 건너뛰었습니다.");
    return {
      ok: true,
      generatedChunkCount,
      structureQualityStatus,
      chunkQualityStatus: "SKIPPED",
      retrievalCaseCount: 0,
      retrievalEvaluationStatus: "SKIPPED",
      preflight: null,
      warnings,
    };
  }

  if (!("error" in chunks)) {
    const chunkQuality = await evaluatePackChunkQuality({
      packId,
      actorClientId: input.actorClientId,
    });
    if ("error" in chunkQuality) {
      chunkQualityStatus = "FAIL";
      warnings.push(
        "message" in chunkQuality && typeof chunkQuality.message === "string"
          ? chunkQuality.message
          : "청킹 품질 점검을 실행하지 못했습니다.",
      );
    } else {
      chunkQualityStatus = asQualityStatus(chunkQuality.report.status);
    }
  } else {
    chunkQualityStatus = "FAIL";
  }

  if (chunkQualityStatus === "FAIL") {
    warnings.push("청킹 품질 점검이 기준에 미달해 검색 품질 평가를 건너뛰었습니다.");
    return {
      ok: true,
      generatedChunkCount,
      structureQualityStatus,
      chunkQualityStatus,
      retrievalCaseCount: 0,
      retrievalEvaluationStatus: "SKIPPED",
      preflight: null,
      warnings,
    };
  }

  // Preflight before cases: ensure enough active chunks
  preflight = await loadRetrievalEvaluationPreflightForPack(packId);
  if (
    !preflight.ready &&
    (preflight.status === "no_active_chunks" || preflight.status === "chunk_insufficient") &&
    (repairRetrievalData || runRetrievalEvaluation)
  ) {
    warnings.push(preflight.userMessage);
    const reinforced = await regenerateAutoChunksForPack({
      packId,
      actorClientId: input.actorClientId,
      mode: "hybrid",
      replace: true,
      reinforce: true,
    });
    if (!("error" in reinforced)) {
      generatedChunkCount = Math.max(generatedChunkCount, reinforced.createdChunkCount);
      warnings.push(...reinforced.warnings);
      warnings.push(`검색용 Chunk ${reinforced.createdChunkCount}개를 자동 보완했습니다.`);
      const recheckQuality = await evaluatePackChunkQuality({
        packId,
        actorClientId: input.actorClientId,
      });
      if (!("error" in recheckQuality)) {
        chunkQualityStatus = asQualityStatus(recheckQuality.report.status);
      }
    }
  }

  const cases = await generateRetrievalEvaluationCasesForPack({
    packId,
    actorClientId: input.actorClientId,
    replace: true,
  });

  if ("error" in cases) {
    warnings.push(
      "message" in cases && typeof cases.message === "string"
        ? cases.message
        : "검색 평가 케이스 생성에 실패했습니다.",
    );
  } else {
    retrievalCaseCount = cases.summary.set?.activeCaseCount ?? 0;
  }

  preflight = await loadRetrievalEvaluationPreflightForPack(packId);

  if (!preflight.ready) {
    warnings.push(preflight.userMessage);
    if (
      preflight.recommendedAction === "regenerate_cases" ||
      preflight.recommendedAction === "regenerate_chunks_and_cases"
    ) {
      if (preflight.recommendedAction === "regenerate_chunks_and_cases") {
        const again = await regenerateAutoChunksForPack({
          packId,
          actorClientId: input.actorClientId,
          mode: "hybrid",
          replace: true,
          reinforce: true,
        });
        if (!("error" in again)) {
          generatedChunkCount = Math.max(generatedChunkCount, again.createdChunkCount);
        }
      }
      const regeneratedCases = await generateRetrievalEvaluationCasesForPack({
        packId,
        actorClientId: input.actorClientId,
        replace: true,
      });
      if (!("error" in regeneratedCases)) {
        retrievalCaseCount = regeneratedCases.summary.set?.activeCaseCount ?? 0;
        if (preflight.mismatchedCaseTitles.length > 0) {
          warnings.push(
            `현재 지식 범위와 맞지 않던 평가 케이스(${preflight.mismatchedCaseTitles.slice(0, 3).join(", ")})를 제외하고 다시 생성했습니다.`,
          );
        }
      }
      preflight = await loadRetrievalEvaluationPreflightForPack(packId);
    }
  }

  if (
    runRetrievalEvaluation &&
    retrievalCaseCount > 0 &&
    (chunkQualityStatus === "PASS" || chunkQualityStatus === "WARNING")
  ) {
    if (!preflight.ready) {
      retrievalEvaluationStatus = "SKIPPED";
      warnings.push(
        "검색용 데이터 정합성이 부족해 검색 품질 평가를 보류했습니다. 점검 탭에서 검색용 데이터 자동 보완을 실행해 주세요.",
      );
    } else {
      const run = await runRetrievalEvaluationForPack({
        packId,
        actorClientId: input.actorClientId,
      });
      if ("error" in run) {
        retrievalEvaluationStatus = "FAIL";
        warnings.push(
          "검색 품질 평가를 자동 실행했지만 완료하지 못했습니다. 검색용 데이터 자동 보완을 다시 실행해 주세요.",
        );
      } else {
        retrievalEvaluationStatus = asQualityStatus(run.summary.latestRun?.status);
        if (retrievalEvaluationStatus === "FAIL") {
          warnings.push(
            "검색 결과 품질이 기준에 미달했습니다. 검색용 데이터 자동 보완으로 Chunk와 평가 케이스를 다시 맞춘 뒤 재점검할 수 있습니다.",
          );
        }
      }
    }
  } else if (retrievalCaseCount === 0) {
    retrievalEvaluationStatus = "SKIPPED";
    warnings.push("검색 평가 케이스가 없어 검색 품질 평가를 건너뛰었습니다.");
  } else {
    retrievalEvaluationStatus = "SKIPPED";
  }

  return {
    ok: true,
    generatedChunkCount,
    structureQualityStatus,
    chunkQualityStatus,
    retrievalCaseCount,
    retrievalEvaluationStatus,
    preflight,
    warnings: [...new Set(warnings)],
  };
}
