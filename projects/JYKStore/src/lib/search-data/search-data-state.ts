/**
 * Provider "검색검증" SearchData UI state model.
 * Legacy local-hash pipeline PASS is never treated as current Local E5 search data.
 */

import { mapSearchDataFailureCode } from "@/lib/search-data/search-data-error";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";

export type SearchDataUiState =
  | "NOT_CREATED"
  | "CREATING"
  | "CREATE_FAILED"
  | "CREATED"
  | "VALIDATING"
  | "VALIDATION_FAILED"
  | "VALIDATED"
  | "STALE";

export type SearchDataStatusResponse = {
  state: SearchDataUiState;
  chunkCount: number;
  processedCount: number;
  vectorCount: number;
  failedCount: number;
  model?: string;
  /** Short display name without org prefix when possible. */
  modelLabel?: string;
  dimension?: number;
  message?: string;
  failureCode?: string | null;
  failureMessage?: string | null;
  retryable?: boolean;
  supportRequired?: boolean;
  canGenerate: boolean;
  canValidate: boolean;
  canRunServiceValidation: boolean;
  /** Technical details — UI shows only when expanded. */
  technical?: {
    searchIndexGenerationId?: string | null;
    chunkGenerationId?: string | null;
    pipelineRunId?: string | null;
    normalizedDocumentId?: string | null;
    fingerprint?: string | null;
    embeddingProvider?: string | null;
    embeddingModel?: string | null;
    embeddingModelRevision?: string | null;
    dimension?: number | null;
    vectorCount?: number;
    indexScope?: string | null;
    indexStatus?: string | null;
    attempt?: number | null;
    failureCode?: string | null;
    legacyLocalHashPresent?: boolean;
  };
  /** Retrieval evaluation summary when available. */
  validationSummary?: {
    totalCases: number;
    passedCases: number;
    status: "PASS" | "FAIL" | "WARNING" | "RUNNING" | "NONE";
    retrievalRankingPolicyVersion?: string | null;
  };
};

export type SearchDataStatusInput = {
  structurePassed: boolean;
  pipelineCurrent: boolean;
  packStatusIsDraft: boolean;
  chunkCount: number;
  /** Current binding SearchIndexGeneration, if any (must match binding ids). */
  generation: {
    id: string;
    status: string;
    scope: string;
    embeddingProvider: string;
    embeddingModel: string;
    embeddingModelRevision: string | null;
    embeddingDimension: number;
    chunkCount: number;
    embeddedCount: number;
    failedCount: number;
    chunkGenerationId: string;
    pipelineRunId: string;
    normalizedDocumentId: string;
    fingerprint: string;
    attempt?: number;
    failureCode?: string | null;
    failureMessage?: string | null;
  } | null;
  vectorCount: number;
  /** INDEXING/SEARCH_EVALUATING pipeline step status for current binding (optional). */
  indexingStepStatus?: string | null;
  evaluationStepStatus?: string | null;
  evaluationPassedCases?: number | null;
  evaluationTotalCases?: number | null;
  /** From SEARCH_EVALUATING step details — missing/outdated forces re-validate. */
  evaluationRankingPolicyVersion?: string | null;
  /** True when an older local-hash index step exists but is not current Local E5 data. */
  legacyLocalHashPresent?: boolean;
};

const LOCAL_E5 = "local-e5";

function modelLabel(model: string): string {
  const parts = model.split("/");
  return parts[parts.length - 1] || model;
}

/** Structure scaffold awaiting user enqueue (Worker must not claim). */
export function isScaffoldGeneration(
  generation: SearchDataStatusInput["generation"],
): boolean {
  return Boolean(
    generation &&
      generation.embeddingProvider === LOCAL_E5 &&
      generation.status === "PENDING" &&
      (generation.attempt ?? 0) === 0,
  );
}

/** User-enqueued or worker-owned Local E5 generation in progress. */
export function isRunningGeneration(
  generation: SearchDataStatusInput["generation"],
): boolean {
  if (!generation || generation.embeddingProvider !== LOCAL_E5) return false;
  if (generation.status === "EMBEDDING") return true;
  if (generation.status === "PENDING" && (generation.attempt ?? 0) > 0) {
    return true;
  }
  return false;
}

function isLocalE5Complete(input: SearchDataStatusInput): boolean {
  const g = input.generation;
  if (!g) return false;
  if (g.embeddingProvider !== LOCAL_E5) return false;
  if (g.embeddingDimension !== 384) return false;
  if (input.chunkCount < 1) return false;
  if (input.vectorCount !== input.chunkCount) return false;
  if (g.embeddedCount < input.chunkCount) return false;
  if (g.failedCount > 0) return false;
  return true;
}

/**
 * Priority:
 * STALE → Scaffold NOT_CREATED → CREATING → eval RUNNING → Generation FAILED →
 * NOT_CREATED → vector mismatch → VALIDATION_FAILED → VALIDATED → CREATED
 */
export function computeSearchDataUiState(input: SearchDataStatusInput): SearchDataUiState {
  if (!input.pipelineCurrent && input.structurePassed) {
    return "STALE";
  }
  if (!input.structurePassed || !input.pipelineCurrent) {
    return "STALE";
  }

  const g = input.generation;

  // Scaffold before enqueue — show generate CTA, never poll as CREATING.
  if (isScaffoldGeneration(g)) {
    return "NOT_CREATED";
  }

  if (isRunningGeneration(g)) {
    return "CREATING";
  }
  if (input.indexingStepStatus === "RUNNING") {
    return "CREATING";
  }
  if (input.evaluationStepStatus === "RUNNING") {
    return "VALIDATING";
  }

  // Binding stale is surfaced as STALE (structure CTA), not CREATE_FAILED.
  if (g && g.status === "FAILED" && g.failureCode === "SEARCH_DATA_BINDING_STALE") {
    return "STALE";
  }

  // Real generation failure always wins over quality validation.
  if (g && g.status === "FAILED") {
    return "CREATE_FAILED";
  }
  if (input.indexingStepStatus === "FAIL") {
    return "CREATE_FAILED";
  }

  const hasUsableGeneration =
    g &&
    g.embeddingProvider === LOCAL_E5 &&
    g.embeddingDimension === 384 &&
    g.status !== "PENDING" &&
    g.status !== "EMBEDDING" &&
    g.status !== "FAILED" &&
    g.status !== "STALE" &&
    g.status !== "RETIRED";

  if (!hasUsableGeneration) {
    return "NOT_CREATED";
  }

  if (!isLocalE5Complete(input)) {
    if (g!.status === "READY" || g!.status === "INDEXING") {
      return "CREATE_FAILED";
    }
    return "NOT_CREATED";
  }

  // Quality fail/warning with intact Local E5 vectors → VALIDATION_FAILED (not CREATE_FAILED).
  if (
    input.evaluationStepStatus === "FAIL" ||
    input.evaluationStepStatus === "WARNING"
  ) {
    return "VALIDATION_FAILED";
  }

  if (
    g!.status === "READY" &&
    (input.evaluationStepStatus === "PASS" ||
      (input.evaluationTotalCases != null &&
        input.evaluationPassedCases != null &&
        input.evaluationTotalCases > 0 &&
        input.evaluationPassedCases === input.evaluationTotalCases))
  ) {
    return "VALIDATED";
  }

  if (g!.status === "READY" || g!.status === "INDEXING") {
    if (input.evaluationStepStatus === "PASS" && g!.status === "READY") {
      return "VALIDATED";
    }
    return "CREATED";
  }

  return "CREATED";
}

/** Tab badge / statusLabel for the 검색검증 step. */
export function searchDataTabStatusLabel(state: SearchDataUiState): string {
  switch (state) {
    case "NOT_CREATED":
      return "시작 전";
    case "CREATING":
    case "VALIDATING":
      return "진행 중";
    case "CREATE_FAILED":
    case "VALIDATION_FAILED":
    case "STALE":
      return "보완 필요";
    case "CREATED":
      return "검증 필요";
    case "VALIDATED":
      return "완료";
  }
}

export function buildSearchDataStatusResponse(
  input: SearchDataStatusInput & {
    message?: string;
    serviceChannelsReady?: boolean;
  },
): SearchDataStatusResponse {
  const state = computeSearchDataUiState(input);
  const g = input.generation;
  const canGenerate =
    input.packStatusIsDraft &&
    input.structurePassed &&
    input.pipelineCurrent &&
    (state === "NOT_CREATED" ||
      state === "CREATE_FAILED" ||
      state === "VALIDATION_FAILED");
  const rankingPolicyStale =
    state === "VALIDATED" &&
    input.evaluationRankingPolicyVersion !== RETRIEVAL_RANKING_POLICY_VERSION;

  const canValidate =
    input.packStatusIsDraft &&
    (state === "CREATED" ||
      state === "VALIDATION_FAILED" ||
      rankingPolicyStale) &&
    isLocalE5Complete(input);
  const canRunServiceValidation =
    input.packStatusIsDraft &&
    state === "VALIDATED" &&
    !rankingPolicyStale &&
    g?.status === "READY" &&
    Boolean(input.serviceChannelsReady ?? true);

  const failureCode =
    state === "CREATE_FAILED" ? (g?.failureCode ?? null) : null;
  const guidance =
    state === "CREATE_FAILED" ? mapSearchDataFailureCode(failureCode) : null;

  let message = input.message;
  if (!message) {
    if (state === "CREATE_FAILED" && guidance) {
      message = guidance.message;
    } else {
      switch (state) {
        case "STALE":
          message = input.structurePassed
            ? "자료 또는 구조화 결과가 변경되었습니다. 데이터 구조화를 다시 실행해 주세요."
            : "데이터 구조화가 완료되지 않았습니다.";
          break;
        case "NOT_CREATED":
          message = "현재 구조화 결과로 생성된 검색데이터가 없습니다.";
          break;
        case "CREATING":
          message = "검색데이터를 생성하는 중입니다.";
          break;
        case "CREATE_FAILED":
          message = "검색데이터 생성에 실패했습니다.";
          break;
        case "CREATED":
          message = "검색데이터 생성이 완료되었습니다.";
          break;
        case "VALIDATING":
          message = "검색 품질을 검증하는 중입니다.";
          break;
        case "VALIDATION_FAILED":
          message = "검색 품질이 기준을 충족하지 못했습니다.";
          break;
        case "VALIDATED":
          message = rankingPolicyStale
            ? "검색 순위 정책이 변경되었습니다. 자동 검색 평가를 다시 실행해 주세요."
            : "검색 품질 검증이 완료되었습니다.";
          break;
      }
    }
  }

  return {
    state,
    chunkCount: input.chunkCount,
    processedCount: g?.embeddedCount ?? 0,
    vectorCount: input.vectorCount,
    failedCount: g?.failedCount ?? 0,
    model: g?.embeddingModel,
    modelLabel: g?.embeddingModel ? modelLabel(g.embeddingModel) : undefined,
    dimension: g?.embeddingDimension,
    message,
    failureCode,
    failureMessage: state === "CREATE_FAILED" ? (g?.failureMessage ?? null) : null,
    retryable: guidance?.retryable,
    supportRequired: guidance?.supportRequired,
    canGenerate,
    canValidate,
    canRunServiceValidation,
    technical: {
      searchIndexGenerationId: g?.id ?? null,
      chunkGenerationId: g?.chunkGenerationId ?? null,
      pipelineRunId: g?.pipelineRunId ?? null,
      normalizedDocumentId: g?.normalizedDocumentId ?? null,
      fingerprint: g?.fingerprint ?? null,
      embeddingProvider: g?.embeddingProvider ?? null,
      embeddingModel: g?.embeddingModel ?? null,
      embeddingModelRevision: g?.embeddingModelRevision ?? null,
      dimension: g?.embeddingDimension ?? null,
      vectorCount: input.vectorCount,
      indexScope: g?.scope ?? null,
      indexStatus: g?.status ?? null,
      attempt: g?.attempt ?? null,
      failureCode: g?.failureCode ?? null,
      legacyLocalHashPresent: Boolean(input.legacyLocalHashPresent),
    },
    validationSummary:
      input.evaluationTotalCases != null
        ? {
            totalCases: input.evaluationTotalCases,
            passedCases: input.evaluationPassedCases ?? 0,
            status:
              rankingPolicyStale
                ? "WARNING"
                : input.evaluationStepStatus === "PASS"
                  ? "PASS"
                  : input.evaluationStepStatus === "FAIL"
                    ? "FAIL"
                    : input.evaluationStepStatus === "WARNING"
                      ? "WARNING"
                      : input.evaluationStepStatus === "RUNNING"
                        ? "RUNNING"
                        : "NONE",
            retrievalRankingPolicyVersion:
              input.evaluationRankingPolicyVersion ?? null,
          }
        : undefined,
  };
}
