import {
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { prisma } from "@/lib/prisma";
import {
  type SearchDataStatusResponse,
} from "@/lib/search-data/search-data-state";
import { loadOwnedPack } from "@/lib/search-data/search-data-generation-shared";
import { getSearchDataStatus } from "@/lib/search-data/search-data-generation-status";
import {
  isEvaluationNonPass,
  runSearchDataRetrievalEvaluation,
} from "@/lib/search-data/search-data-generation-evaluation-runner";
import {
  auditSearchDataValidationStarted,
  markSearchEvaluatingRunning,
  writeEvaluationNonPass,
  writeEvaluationPassAndActivate,
  writeEvaluationThrownFailure,
} from "@/lib/search-data/search-data-generation-evaluation-writes";

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

  await auditSearchDataValidationStarted({
    packId: input.packId,
    userId: input.userId,
    indexGenerationId,
  });

  try {
    await markSearchEvaluatingRunning(latest.id);

    const { evaluation, evaluationDetails } = await runSearchDataRetrievalEvaluation({
      packId: input.packId,
      versionId: version.id,
      indexGenerationId,
    });

    if (isEvaluationNonPass(evaluation.status)) {
      await writeEvaluationNonPass({
        packId: input.packId,
        userId: input.userId,
        runId: latest.id,
        indexGenerationId,
        evaluationStatus: evaluation.status,
        failureCode: evaluation.failureCode,
        evaluationDetails: evaluationDetails as unknown as Record<string, unknown>,
      });
      return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
    }

    await writeEvaluationPassAndActivate({
      packId: input.packId,
      userId: input.userId,
      runId: latest.id,
      versionId: version.id,
      indexGenerationId,
      fingerprint: binding.fingerprint,
      normalizedDocumentId: binding.normalizedDocumentId,
      evaluationDetails: evaluationDetails as unknown as Record<string, unknown>,
    });

    return getSearchDataStatus(input) as Promise<SearchDataStatusResponse>;
  } catch (error) {
    await writeEvaluationThrownFailure({
      packId: input.packId,
      userId: input.userId,
      runId: latest.id,
      indexGenerationId,
      error,
    });
    return {
      error: "INVALID",
      message: "검색 품질 검증에 실패했습니다. 다시 시도해 주세요.",
      code: "RETRIEVAL_EVALUATION_FAILED",
    };
  }
}
