/**
 * Search-data pipeline step transitions (INDEXING / SEARCH_EVALUATING / READY_FOR_REVIEW).
 * Does not write provider audit — use search-data-generation-events for those.
 */
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
import { completePipelineStep, updatePackPipelineStatus } from "@/lib/pipeline-service";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import { mapSearchDataFailureCode } from "@/lib/search-data/search-data-error";
import { SEARCH_DATA_FAILURE } from "@/lib/search-data/search-data-generation-failures";

export async function markSearchDataIndexingRunning(input: {
  runId: string;
  searchIndexGenerationId: string;
  attempt: number;
}): Promise<void> {
  await completePipelineStep({
    runId: input.runId,
    step: "INDEXING",
    status: "RUNNING",
    message: "검색데이터를 생성하는 중…",
    details: {
      draft: true,
      indexGenerationId: input.searchIndexGenerationId,
      searchIndexGenerationId: input.searchIndexGenerationId,
      attempt: input.attempt,
    },
  }).catch(() => undefined);
}

export async function markSearchDataIndexingPassed(input: {
  runId: string;
  searchIndexGenerationId: string;
  attempt: number;
  processedCount: number;
  vectorCount: number;
}): Promise<void> {
  await completePipelineStep({
    runId: input.runId,
    step: "INDEXING",
    status: "PASS",
    message: `검색데이터 ${input.vectorCount}건을 생성했습니다.`,
    details: {
      draft: true,
      indexGenerationId: input.searchIndexGenerationId,
      searchIndexGenerationId: input.searchIndexGenerationId,
      indexScope: "DRAFT",
      embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
      processedCount: input.processedCount,
      vectorCount: input.vectorCount,
      attempt: input.attempt,
    },
  });
}

export async function markSearchDataIndexingFailed(input: {
  runId: string;
  failureCode: string;
  message?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await completePipelineStep({
    runId: input.runId,
    step: "INDEXING",
    status: "FAIL",
    message: input.message ?? mapSearchDataFailureCode(input.failureCode).message,
    details: input.details ?? { failureCode: input.failureCode },
  }).catch(() => undefined);
}

export async function markSearchDataIndexingVectorMismatch(input: {
  runId: string;
  vectorCount: number;
  expectedChunks: number;
}): Promise<void> {
  await markSearchDataIndexingFailed({
    runId: input.runId,
    failureCode: SEARCH_DATA_FAILURE.VECTOR_COUNT_MISMATCH,
    message: "검색데이터 저장이 완료되지 않았습니다.",
    details: {
      failureCode: SEARCH_DATA_FAILURE.VECTOR_COUNT_MISMATCH,
      vectorCount: input.vectorCount,
      expectedChunks: input.expectedChunks,
    },
  });
}

export async function markSearchDataEvaluatingRunning(runId: string): Promise<void> {
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

export async function markSearchDataEvaluationNonPass(input: {
  runId: string;
  evaluationStatus: "FAIL" | "WARNING";
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
}

export async function markSearchDataEvaluationPassed(input: {
  runId: string;
  evaluationDetails: Record<string, unknown>;
}): Promise<void> {
  await completePipelineStep({
    runId: input.runId,
    step: "SEARCH_EVALUATING",
    status: "PASS",
    message: "검색 품질 검증이 완료되었습니다.",
    details: input.evaluationDetails,
  });
}

export async function markSearchDataEvaluationThrownFailure(input: {
  runId: string;
  error: unknown;
}): Promise<void> {
  await completePipelineStep({
    runId: input.runId,
    step: "SEARCH_EVALUATING",
    status: "FAIL",
    message: "검색 품질 검증에 실패했습니다.",
    details: {
      failureCode: SEARCH_DATA_FAILURE.RETRIEVAL_EVALUATION_FAILED,
      message: input.error instanceof Error ? input.error.message.slice(0, 300) : null,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    },
  }).catch(() => undefined);
}

export async function markSearchDataReadyForReview(input: {
  packId: string;
  runId: string;
  searchIndexGenerationId: string;
  fingerprint: string;
  versionId: string;
  normalizedDocumentId: string;
}): Promise<void> {
  await completePipelineStep({
    runId: input.runId,
    step: "READY_FOR_REVIEW",
    status: "PASS",
    message: "검색데이터 생성·검증 완료",
    details: {
      searchIndexGenerationId: input.searchIndexGenerationId,
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
}
