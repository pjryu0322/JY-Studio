import { loadChunkQualitySummaryForPack } from "@/lib/chunk-quality/chunk-quality-freshness";
import { LEGACY_BUILDER_DISABLED_MESSAGE } from "@/lib/legacy-builder-disabled";
import { prisma } from "@/lib/prisma";
import {
  evaluateReleaseGateForPack,
  loadReleaseGateSummaryForPack,
} from "@/lib/release-gate/release-gate-service";
import { loadRetrievalEvaluationSummaryForPack } from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";
import {
  countSourceValidationFromStatuses,
  meetsSourceValidationSubmitGate,
} from "@/lib/source-validation-readiness";
import { loadStructureQualitySummaryForPack } from "@/lib/structure-quality/structure-quality-freshness";
import { PackStatus } from "@prisma/client";

export type ProviderFinalReviewSubmitPreparationResult =
  | {
      ok: true;
      packId: string;
      submittedVersionId: string;
      releaseGateStatus: "PASS" | "WARNING";
      sourceDocumentCount: number;
      generatedChunkCount: number;
      retrievalCaseCount: number;
      retrievalEvaluationStatus: "PASS" | "WARNING";
      releaseGateRunId: string;
      retrievalEvaluationRunId?: string;
      retrievalEvaluationSetId?: string;
      activeChunkIds: string[];
      sourceDocumentIds: string[];
      warnings: string[];
    }
  | {
      ok: false;
      packId: string;
      blockingStage:
        | "source_validation"
        | "structure_quality"
        | "chunk_quality"
        | "retrieval_cases"
        | "retrieval_evaluation"
        | "release_gate";
      message: string;
      warnings: string[];
    };

function asPassWarning(status: string | null | undefined): "PASS" | "WARNING" | "FAIL" {
  if (status === "PASS" || status === "WARNING") return status;
  return "FAIL";
}

/**
 * P28 Legacy Builder Freeze: validate existing Builder data only.
 * Does not regenerate chunks, retrieval cases, or re-run source validation writes.
 */
export async function prepareProviderPackForFinalReviewSubmit(input: {
  packId: string;
  actorClientId?: string;
  providerProfileId?: string;
}): Promise<ProviderFinalReviewSubmitPreparationResult> {
  const packId = input.packId.trim();
  const warnings: string[] = [];

  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId,
      ...(input.providerProfileId ? { providerProfileId: input.providerProfileId } : {}),
    },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        include: { sourceDocuments: { select: { id: true } } },
      },
    },
  });

  if (!pack || pack.status !== PackStatus.DRAFT) {
    return {
      ok: false,
      packId,
      blockingStage: "source_validation",
      message: "초안(DRAFT) 상태의 지식팩만 최종 점검을 실행할 수 있습니다.",
      warnings,
    };
  }

  const submittedVersion = pack.versions[0];
  if (!submittedVersion) {
    return {
      ok: false,
      packId,
      blockingStage: "source_validation",
      message: "버전이 없습니다.",
      warnings,
    };
  }

  const submittedVersionId = submittedVersion.id;
  const sourceDocumentIds = submittedVersion.sourceDocuments.map((d) => d.id);
  if (sourceDocumentIds.length === 0) {
    return {
      ok: false,
      packId,
      blockingStage: "source_validation",
      message: "원천 문서를 최소 1개 등록해 주세요.",
      warnings,
    };
  }

  const docs = await prisma.sourceDocument.findMany({
    where: { versionId: submittedVersionId },
    select: { id: true, validationStatus: true },
  });
  const validationCounts = countSourceValidationFromStatuses(docs.map((d) => d.validationStatus));
  if (!meetsSourceValidationSubmitGate(validationCounts)) {
    return {
      ok: false,
      packId,
      blockingStage: "source_validation",
      message:
        validationCounts.failCount > 0
          ? "원천 문서 검증 FAIL이 있어 검수 요청을 제출할 수 없습니다."
          : "검증되지 않은 원천 문서가 있어 검수 요청을 제출할 수 없습니다.",
      warnings,
    };
  }

  const activeChunks = await prisma.knowledgeChunk.findMany({
    where: { isActive: true, versionId: submittedVersionId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const generatedChunkCount = activeChunks.length;
  if (generatedChunkCount <= 0) {
    return {
      ok: false,
      packId,
      blockingStage: "chunk_quality",
      message:
        "활성 Chunk가 없어 검수 요청을 제출할 수 없습니다. " + LEGACY_BUILDER_DISABLED_MESSAGE,
      warnings,
    };
  }

  const structureQuality = await loadStructureQualitySummaryForPack(packId);
  if (!structureQuality?.structureCoverage || !structureQuality.knowledgeQuality) {
    return {
      ok: false,
      packId,
      blockingStage: "structure_quality",
      message: "구조/품질 점검 결과가 없습니다. 기존 점검 데이터가 준비된 팩만 제출할 수 있습니다.",
      warnings,
    };
  }
  if (
    structureQuality.structureCoverage.status === "FAIL" ||
    structureQuality.knowledgeQuality.status === "FAIL"
  ) {
    return {
      ok: false,
      packId,
      blockingStage: "structure_quality",
      message: "구조/품질 점검이 FAIL입니다. 보완 후 다시 제출해 주세요.",
      warnings,
    };
  }

  const chunkQuality = await loadChunkQualitySummaryForPack(packId);
  if (!chunkQuality.report) {
    return {
      ok: false,
      packId,
      blockingStage: "chunk_quality",
      message: "청킹 품질 점검 결과가 없습니다. 기존 점검 데이터가 준비된 팩만 제출할 수 있습니다.",
      warnings,
    };
  }
  if (chunkQuality.report.status === "FAIL") {
    return {
      ok: false,
      packId,
      blockingStage: "chunk_quality",
      message: "청킹 품질 점검이 FAIL입니다. Chunk를 보완한 뒤 다시 제출해 주세요.",
      warnings,
    };
  }

  const retrieval = await loadRetrievalEvaluationSummaryForPack(packId);
  const retrievalCaseCount = retrieval.set?.activeCaseCount ?? 0;
  if (!retrieval.set || retrievalCaseCount <= 0) {
    return {
      ok: false,
      packId,
      blockingStage: "retrieval_cases",
      message:
        "활성 검색 평가 케이스가 없어 검수 요청을 제출할 수 없습니다. " +
        LEGACY_BUILDER_DISABLED_MESSAGE,
      warnings,
    };
  }

  if (!retrieval.latestRun) {
    return {
      ok: false,
      packId,
      blockingStage: "retrieval_evaluation",
      message: "검색 품질 평가 결과가 없습니다. 기존 평가 데이터가 준비된 팩만 제출할 수 있습니다.",
      warnings,
    };
  }
  const retrievalEvaluationStatus = asPassWarning(retrieval.latestRun.status);
  if (retrievalEvaluationStatus === "FAIL") {
    return {
      ok: false,
      packId,
      blockingStage: "retrieval_evaluation",
      message: "검색 품질 평가가 FAIL입니다. 보완 후 다시 제출해 주세요.",
      warnings,
    };
  }

  let releaseGateRunId: string;
  let releaseGateStatus: "PASS" | "WARNING";

  const existingGate = await loadReleaseGateSummaryForPack(packId);
  const existingGateStatus = existingGate.latestRun
    ? asPassWarning(existingGate.latestRun.status)
    : null;

  if (existingGate.latestRun && existingGateStatus !== null && existingGateStatus !== "FAIL") {
    releaseGateRunId = existingGate.latestRun.id;
    releaseGateStatus = existingGateStatus;
  } else if (existingGate.latestRun && existingGateStatus === "FAIL") {
    return {
      ok: false,
      packId,
      blockingStage: "release_gate",
      message: "릴리스 게이트가 FAIL입니다. 차단 항목을 해결한 뒤 다시 제출해 주세요.",
      warnings,
    };
  } else {
    const releaseGate = await evaluateReleaseGateForPack({
      packId,
      actorClientId: input.actorClientId,
      targetStatus: "PUBLISHED",
      persist: true,
    });
    if ("error" in releaseGate) {
      return {
        ok: false,
        packId,
        blockingStage: "release_gate",
        message: "릴리스 게이트 사전 점검을 실행하지 못했습니다.",
        warnings,
      };
    }
    const evaluatedStatus = asPassWarning(releaseGate.result.status);
    if (evaluatedStatus === "FAIL") {
      return {
        ok: false,
        packId,
        blockingStage: "release_gate",
        message: "릴리스 게이트가 FAIL입니다. 차단 항목을 해결한 뒤 다시 제출해 주세요.",
        warnings,
      };
    }
    releaseGateRunId = releaseGate.result.id;
    releaseGateStatus = evaluatedStatus;
  }

  return {
    ok: true,
    packId,
    submittedVersionId,
    releaseGateStatus,
    sourceDocumentCount: sourceDocumentIds.length,
    generatedChunkCount,
    retrievalCaseCount,
    retrievalEvaluationStatus,
    releaseGateRunId,
    retrievalEvaluationRunId: retrieval.latestRun.id,
    retrievalEvaluationSetId: retrieval.set.id,
    activeChunkIds: activeChunks.map((c) => c.id),
    sourceDocumentIds,
    warnings,
  };
}
