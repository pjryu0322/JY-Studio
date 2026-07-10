import { regenerateAutoChunksForPack } from "@/lib/auto-pipeline/provider-auto-chunk-service";
import { evaluatePackChunkQuality } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import { prisma } from "@/lib/prisma";
import {
  generateRetrievalEvaluationCasesForPack,
  runRetrievalEvaluationForPack,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-service";
import { evaluateReleaseGateForPack } from "@/lib/release-gate/release-gate-service";
import {
  countSourceValidationFromStatuses,
  meetsSourceValidationSubmitGate,
} from "@/lib/source-validation-readiness";
import { validateAllSourceDocumentsForPack } from "@/lib/source-validation/source-validation-report-service";
import { evaluatePackStructureQuality } from "@/lib/structure-quality/structure-quality-evaluate-service";
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

export async function prepareProviderPackForFinalReviewSubmit(input: {
  packId: string;
  actorClientId?: string;
  providerProfileId?: string;
}): Promise<ProviderFinalReviewSubmitPreparationResult> {
  const packId = input.packId.trim();
  const warnings: string[] = [];
  const actorClientId = input.actorClientId;

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

  await validateAllSourceDocumentsForPack(packId, { actorClientId });
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

  const structure = await evaluatePackStructureQuality({ packId, actorClientId });
  if ("error" in structure) {
    return {
      ok: false,
      packId,
      blockingStage: "structure_quality",
      message:
        structure.error === "NO_VERSION"
          ? "버전이 없어 구조/품질 점검을 실행하지 못했습니다."
          : "구조/품질 점검을 실행하지 못했습니다.",
      warnings,
    };
  }
  if (
    structure.structureCoverage.status === "FAIL" ||
    structure.knowledgeQuality.status === "FAIL"
  ) {
    return {
      ok: false,
      packId,
      blockingStage: "structure_quality",
      message: "구조/품질 점검이 FAIL입니다. 보완 후 다시 제출해 주세요.",
      warnings,
    };
  }

  const chunks = await regenerateAutoChunksForPack({
    packId,
    actorClientId,
    mode: "hybrid",
    replace: true,
    reinforce: true,
  });
  if ("error" in chunks) {
    return {
      ok: false,
      packId,
      blockingStage: "chunk_quality",
      message: chunks.message,
      warnings,
    };
  }
  const generatedChunkCount = chunks.createdChunkCount;
  warnings.push(...chunks.warnings);

  const activeChunkCount = await prisma.knowledgeChunk.count({
    where: { isActive: true, versionId: submittedVersionId },
  });
  if (activeChunkCount <= 0) {
    return {
      ok: false,
      packId,
      blockingStage: "chunk_quality",
      message: "검수용 Chunk가 생성되지 않아 제출할 수 없습니다.",
      warnings,
    };
  }

  const chunkQuality = await evaluatePackChunkQuality({ packId, actorClientId });
  if ("error" in chunkQuality) {
    return {
      ok: false,
      packId,
      blockingStage: "chunk_quality",
      message:
        "message" in chunkQuality && typeof chunkQuality.message === "string"
          ? chunkQuality.message
          : "청킹 품질 점검을 실행하지 못했습니다.",
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

  const cases = await generateRetrievalEvaluationCasesForPack({
    packId,
    actorClientId,
    replace: true,
  });
  if ("error" in cases) {
    return {
      ok: false,
      packId,
      blockingStage: "retrieval_cases",
      message:
        "message" in cases && typeof cases.message === "string"
          ? cases.message
          : "검색 평가 케이스 생성에 실패했습니다.",
      warnings,
    };
  }
  const retrievalCaseCount = cases.summary.set?.activeCaseCount ?? 0;
  if (retrievalCaseCount <= 0) {
    return {
      ok: false,
      packId,
      blockingStage: "retrieval_cases",
      message: "활성 검색 평가 케이스가 없어 검수 요청을 제출할 수 없습니다.",
      warnings,
    };
  }

  const retrieval = await runRetrievalEvaluationForPack({ packId, actorClientId });
  if ("error" in retrieval) {
    return {
      ok: false,
      packId,
      blockingStage: "retrieval_evaluation",
      message:
        "message" in retrieval && typeof retrieval.message === "string"
          ? retrieval.message
          : "검색 품질 평가 실행에 실패했습니다.",
      warnings,
    };
  }
  const retrievalEvaluationStatus = asPassWarning(retrieval.summary.latestRun?.status);
  if (retrievalEvaluationStatus === "FAIL") {
    return {
      ok: false,
      packId,
      blockingStage: "retrieval_evaluation",
      message: "검색 품질 평가가 FAIL입니다. 보완 후 다시 제출해 주세요.",
      warnings,
    };
  }

  const releaseGate = await evaluateReleaseGateForPack({
    packId,
    actorClientId,
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
  const releaseGateStatus = asPassWarning(releaseGate.result.status);
  if (releaseGateStatus === "FAIL") {
    return {
      ok: false,
      packId,
      blockingStage: "release_gate",
      message: "릴리스 게이트가 FAIL입니다. 차단 항목을 해결한 뒤 다시 제출해 주세요.",
      warnings,
    };
  }

  const activeChunks = await prisma.knowledgeChunk.findMany({
    where: { isActive: true, versionId: submittedVersionId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    ok: true,
    packId,
    submittedVersionId,
    releaseGateStatus,
    sourceDocumentCount: sourceDocumentIds.length,
    generatedChunkCount,
    retrievalCaseCount,
    retrievalEvaluationStatus,
    releaseGateRunId: releaseGate.result.id,
    retrievalEvaluationRunId: retrieval.summary.latestRun?.id,
    retrievalEvaluationSetId: cases.summary.set?.id,
    activeChunkIds: activeChunks.map((c) => c.id),
    sourceDocumentIds,
    warnings,
  };
}
