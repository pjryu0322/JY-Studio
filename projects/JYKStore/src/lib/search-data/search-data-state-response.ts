/**
 * Assembles SearchDataStatusResponse without changing public shape.
 */
import { mapSearchDataFailureCode } from "@/lib/search-data/search-data-error";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import type {
  SearchDataStatusInput,
  SearchDataStatusResponse,
} from "@/lib/search-data/search-data-state-types";
import {
  canGenerateSearchData,
  canRunServiceValidationForSearchData,
  canValidateSearchDataState,
  computeSearchDataUiState,
  isLocalE5Complete,
  isSearchDataRankingPolicyStale,
} from "@/lib/search-data/search-data-state-policy";
import {
  resolveSearchDataStatusMessage,
  resolveValidationSummaryStatus,
  searchDataModelLabel,
} from "@/lib/search-data/search-data-state-ui";

export function buildSearchDataStatusResponse(
  input: SearchDataStatusInput & {
    message?: string;
    serviceChannelsReady?: boolean;
  },
): SearchDataStatusResponse {
  const state = computeSearchDataUiState(input);
  const g = input.generation;
  const rankingPolicyStale = isSearchDataRankingPolicyStale(
    state,
    input.evaluationRankingPolicyVersion,
  );
  const localE5Complete = isLocalE5Complete(input);

  const canGenerate = canGenerateSearchData({
    packStatusIsDraft: input.packStatusIsDraft,
    structurePassed: input.structurePassed,
    pipelineCurrent: input.pipelineCurrent,
    state,
  });
  const canValidate = canValidateSearchDataState({
    packStatusIsDraft: input.packStatusIsDraft,
    state,
    rankingPolicyStale,
    localE5Complete,
  });
  const canRunServiceValidation = canRunServiceValidationForSearchData({
    packStatusIsDraft: input.packStatusIsDraft,
    state,
    rankingPolicyStale,
    generationStatus: g?.status,
    serviceChannelsReady: Boolean(input.serviceChannelsReady ?? true),
  });

  const failureCode =
    state === "CREATE_FAILED" ? (g?.failureCode ?? null) : null;
  const guidance =
    state === "CREATE_FAILED" ? mapSearchDataFailureCode(failureCode) : null;

  const message = resolveSearchDataStatusMessage({
    state,
    structurePassed: input.structurePassed,
    rankingPolicyStale,
    overrideMessage: input.message,
    createFailedGuidance: guidance,
  });

  return {
    state,
    chunkCount: input.chunkCount,
    processedCount: g?.embeddedCount ?? 0,
    vectorCount: input.vectorCount,
    failedCount: g?.failedCount ?? 0,
    model: g?.embeddingModel,
    modelLabel: g?.embeddingModel ? searchDataModelLabel(g.embeddingModel) : undefined,
    dimension: g?.embeddingDimension,
    message,
    failureCode,
    failureMessage: state === "CREATE_FAILED" ? (g?.failureMessage ?? null) : null,
    retryable: guidance?.retryable,
    supportRequired: guidance?.supportRequired,
    canGenerate,
    canValidate,
    canRunServiceValidation,
    rankingPolicyStale,
    currentRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    evaluatedRankingPolicyVersion: input.evaluationRankingPolicyVersion ?? null,
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
            status: resolveValidationSummaryStatus({
              rankingPolicyStale,
              evaluationStepStatus: input.evaluationStepStatus,
            }),
            retrievalRankingPolicyVersion:
              input.evaluationRankingPolicyVersion ?? null,
          }
        : undefined,
  };
}
