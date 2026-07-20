/**
 * Pipeline step / audit / activation writes for validateSearchData.
 */
import { AuditAction } from "@prisma/client";
import { activateDraftIndexGeneration } from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
import { recordProviderAudit } from "@/lib/provider-audit";
import { completePipelineStep, updatePackPipelineStatus } from "@/lib/pipeline-service";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";

export async function auditSearchDataValidationStarted(input: {
  packId: string;
  userId: string;
  indexGenerationId: string;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: "SEARCH_DATA_VALIDATION_STARTED",
      searchIndexGenerationId: input.indexGenerationId,
    },
  });
}

export async function markSearchEvaluatingRunning(runId: string): Promise<void> {
  await completePipelineStep({
    runId,
    step: "SEARCH_EVALUATING",
    status: "RUNNING",
    message: "검색 품질을 검증하는 중…",
    details: {
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    },
  });
}

export async function writeEvaluationNonPass(input: {
  packId: string;
  userId: string;
  runId: string;
  indexGenerationId: string;
  evaluationStatus: "FAIL" | "WARNING";
  failureCode: string | null | undefined;
  evaluationDetails: Record<string, unknown>;
}): Promise<void> {
  await completePipelineStep({
    runId: input.runId,
    step: "SEARCH_EVALUATING",
    status: input.evaluationStatus === "FAIL" ? "FAIL" : "WARNING",
    message:
      input.evaluationStatus === "FAIL"
        ? "검색 품질이 기준을 충족하지 못했습니다."
        : "검색 검증에 보완이 필요합니다.",
    details: input.evaluationDetails,
  });
  // Keep SearchIndexGeneration INDEXING — do not failDraftIndexGeneration.
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: "SEARCH_DATA_VALIDATION_FAILED",
      failureCode: input.failureCode ?? "RETRIEVAL_EVALUATION_FAILED",
      searchIndexGenerationId: input.indexGenerationId,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    },
  });
}

export async function writeEvaluationPassAndActivate(input: {
  packId: string;
  userId: string;
  runId: string;
  versionId: string;
  indexGenerationId: string;
  fingerprint: string;
  normalizedDocumentId: string;
  evaluationDetails: Record<string, unknown>;
}): Promise<void> {
  await activateDraftIndexGeneration({
    versionId: input.versionId,
    indexGenerationId: input.indexGenerationId,
  });

  await completePipelineStep({
    runId: input.runId,
    step: "SEARCH_EVALUATING",
    status: "PASS",
    message: "검색 품질 검증이 완료되었습니다.",
    details: input.evaluationDetails,
  });

  await completePipelineStep({
    runId: input.runId,
    step: "READY_FOR_REVIEW",
    status: "PASS",
    message: "검색데이터 생성·검증 완료",
    details: {
      searchIndexGenerationId: input.indexGenerationId,
      fingerprint: input.fingerprint,
      versionId: input.versionId,
      normalizedDocumentId: input.normalizedDocumentId,
    },
  });

  await updatePackPipelineStatus({
    packId: input.packId,
    pipelineStatus: "READY_FOR_REVIEW",
    message: "Search data validation passed",
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: "SEARCH_DATA_VALIDATION_COMPLETED",
      searchIndexGenerationId: input.indexGenerationId,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    },
  });
}

export async function writeEvaluationThrownFailure(input: {
  packId: string;
  userId: string;
  runId: string;
  indexGenerationId: string;
  error: unknown;
}): Promise<void> {
  await completePipelineStep({
    runId: input.runId,
    step: "SEARCH_EVALUATING",
    status: "FAIL",
    message: "검색 품질 검증에 실패했습니다.",
    details: {
      failureCode: "RETRIEVAL_EVALUATION_FAILED",
      message: input.error instanceof Error ? input.error.message.slice(0, 300) : null,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    },
  }).catch(() => undefined);
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: "SEARCH_DATA_VALIDATION_FAILED",
      failureCode: "RETRIEVAL_EVALUATION_FAILED",
      searchIndexGenerationId: input.indexGenerationId,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    },
  }).catch(() => undefined);
}
