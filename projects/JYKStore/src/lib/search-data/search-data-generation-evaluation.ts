import { AuditAction } from "@prisma/client";
import {
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { runDoclingRetrievalEvaluation } from "@/lib/docling-knowledge/docling-knowledge-eval";
import { activateDraftIndexGeneration } from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { completePipelineStep, updatePackPipelineStatus } from "@/lib/pipeline-service";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import {
  type SearchDataStatusResponse,
} from "@/lib/search-data/search-data-state";
import { loadOwnedPack } from "@/lib/search-data/search-data-generation-shared";
import { getSearchDataStatus } from "@/lib/search-data/search-data-generation-status";

/**
 * Runs retrieval quality evaluation and activates Draft READY generation.
 * Eval FAIL/WARNING keeps Generation INDEXING (VALIDATION_FAILED UI).
 */
export async function validateSearchData(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<
  | { error: "NOT_FOUND" | "PROFILE_REQUIRED" | "INVALID"; message: string; code?: string }
  | SearchDataStatusResponse
> {
  const status = await getSearchDataStatus(input);
  if ("error" in status) {
    return { error: status.error, message: "팩을 찾을 수 없습니다." };
  }
  if (!status.canValidate && status.state !== "VALIDATION_FAILED") {
    return {
      error: "INVALID",
      message:
        status.state === "NOT_CREATED" || status.state === "CREATE_FAILED"
          ? "검색데이터를 먼저 생성해 주세요."
          : status.message ?? "검색 품질 검증을 실행할 수 없습니다.",
      code: "VALIDATE_NOT_READY",
    };
  }

  const owned = await loadOwnedPack(input);
  if (!owned.ok) return { error: owned.error, message: "팩을 찾을 수 없습니다." };
  const version = owned.pack.versions[0];
  if (!version) {
    return { error: "INVALID", message: "버전 정보가 없습니다.", code: "VERSION_REQUIRED" };
  }

  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
  });
  const binding = latest ? parseKnowledgeRunBinding(latest.summary) : null;
  if (!latest || !binding?.indexGenerationId) {
    return { error: "INVALID", message: "구조화 Binding이 없습니다.", code: "BINDING_REQUIRED" };
  }
  const indexGenerationId = binding.indexGenerationId;

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: "SEARCH_DATA_VALIDATION_STARTED",
      searchIndexGenerationId: indexGenerationId,
    },
  });

  try {
    await completePipelineStep({
      runId: latest.id,
      step: "SEARCH_EVALUATING",
      status: "RUNNING",
      message: "검색 품질을 검증하는 중…",
      details: {
        retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      },
    });

    const evaluation = await runDoclingRetrievalEvaluation({
      packId: input.packId,
      versionId: version.id,
      indexGenerationId,
    });
    const evaluationDetails = {
      ...evaluation,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    };

    if (evaluation.status === "FAIL" || evaluation.status === "WARNING") {
      await completePipelineStep({
        runId: latest.id,
        step: "SEARCH_EVALUATING",
        status: evaluation.status === "FAIL" ? "FAIL" : "WARNING",
        message:
          evaluation.status === "FAIL"
            ? "검색 품질이 기준을 충족하지 못했습니다."
            : "검색 검증에 보완이 필요합니다.",
        details: evaluationDetails as unknown as Record<string, unknown>,
      });
      // Keep SearchIndexGeneration INDEXING — do not failDraftIndexGeneration.
      await recordProviderAudit({
        action: AuditAction.PROVIDER_PACK_UPDATE,
        entityType: "KnowledgePack",
        entityId: input.packId,
        actorUserId: input.userId,
        metadata: {
          event: "SEARCH_DATA_VALIDATION_FAILED",
          failureCode: evaluation.failureCode ?? "RETRIEVAL_EVALUATION_FAILED",
          searchIndexGenerationId: indexGenerationId,
          retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
        },
      });
      return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
    }

    await activateDraftIndexGeneration({
      versionId: version.id,
      indexGenerationId,
    });

    await completePipelineStep({
      runId: latest.id,
      step: "SEARCH_EVALUATING",
      status: "PASS",
      message: "검색 품질 검증이 완료되었습니다.",
      details: evaluationDetails as unknown as Record<string, unknown>,
    });

    await completePipelineStep({
      runId: latest.id,
      step: "READY_FOR_REVIEW",
      status: "PASS",
      message: "검색데이터 생성·검증 완료",
      details: {
        searchIndexGenerationId: indexGenerationId,
        fingerprint: binding.fingerprint,
        versionId: version.id,
        normalizedDocumentId: binding.normalizedDocumentId,
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
        searchIndexGenerationId: indexGenerationId,
        retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      },
    });

    return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
  } catch (error) {
    await completePipelineStep({
      runId: latest.id,
      step: "SEARCH_EVALUATING",
      status: "FAIL",
      message: "검색 품질 검증에 실패했습니다.",
      details: {
        failureCode: "RETRIEVAL_EVALUATION_FAILED",
        message: error instanceof Error ? error.message.slice(0, 300) : null,
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
        searchIndexGenerationId: indexGenerationId,
        retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      },
    }).catch(() => undefined);
    return {
      error: "INVALID",
      message: "검색 품질 검증에 실패했습니다. 다시 시도해 주세요.",
      code: "RETRIEVAL_EVALUATION_FAILED",
    };
  }
}
