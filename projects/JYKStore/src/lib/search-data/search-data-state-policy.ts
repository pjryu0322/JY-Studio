/**
 * Pure search-data UI state policy (no DB, no provider-facing copy).
 */
import type {
  SearchDataStatusInput,
  SearchDataUiState,
} from "@/lib/search-data/search-data-state-types";
import { SEARCH_DATA_LOCAL_E5_PROVIDER } from "@/lib/search-data/search-data-state-types";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";

/** Structure scaffold awaiting user enqueue (Worker must not claim). */
export function isScaffoldGeneration(
  generation: SearchDataStatusInput["generation"],
): boolean {
  return Boolean(
    generation &&
      generation.embeddingProvider === SEARCH_DATA_LOCAL_E5_PROVIDER &&
      generation.status === "PENDING" &&
      (generation.attempt ?? 0) === 0,
  );
}

/** User-enqueued or worker-owned Local E5 generation in progress. */
export function isRunningGeneration(
  generation: SearchDataStatusInput["generation"],
): boolean {
  if (!generation || generation.embeddingProvider !== SEARCH_DATA_LOCAL_E5_PROVIDER) {
    return false;
  }
  if (generation.status === "EMBEDDING") return true;
  if (generation.status === "PENDING" && (generation.attempt ?? 0) > 0) {
    return true;
  }
  return false;
}

export function isLocalE5Complete(input: SearchDataStatusInput): boolean {
  const g = input.generation;
  if (!g) return false;
  if (g.embeddingProvider !== SEARCH_DATA_LOCAL_E5_PROVIDER) return false;
  if (g.embeddingDimension !== 384) return false;
  if (input.chunkCount < 1) return false;
  if (input.vectorCount !== input.chunkCount) return false;
  if (g.embeddedCount < input.chunkCount) return false;
  if (g.failedCount > 0) return false;
  return true;
}

function hasUsableLocalE5Generation(
  generation: SearchDataStatusInput["generation"],
): boolean {
  return Boolean(
    generation &&
      generation.embeddingProvider === SEARCH_DATA_LOCAL_E5_PROVIDER &&
      generation.embeddingDimension === 384 &&
      generation.status !== "PENDING" &&
      generation.status !== "EMBEDDING" &&
      generation.status !== "FAILED" &&
      generation.status !== "STALE" &&
      generation.status !== "RETIRED",
  );
}

function resolveValidatedOrCreated(
  input: SearchDataStatusInput,
  generation: NonNullable<SearchDataStatusInput["generation"]>,
): SearchDataUiState {
  // Quality fail/warning with intact Local E5 vectors → VALIDATION_FAILED (not CREATE_FAILED).
  if (
    input.evaluationStepStatus === "FAIL" ||
    input.evaluationStepStatus === "WARNING"
  ) {
    return "VALIDATION_FAILED";
  }

  if (
    generation.status === "READY" &&
    (input.evaluationStepStatus === "PASS" ||
      (input.evaluationTotalCases != null &&
        input.evaluationPassedCases != null &&
        input.evaluationTotalCases > 0 &&
        input.evaluationPassedCases === input.evaluationTotalCases))
  ) {
    return "VALIDATED";
  }

  if (generation.status === "READY" || generation.status === "INDEXING") {
    if (input.evaluationStepStatus === "PASS" && generation.status === "READY") {
      return "VALIDATED";
    }
    return "CREATED";
  }

  return "CREATED";
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

  if (!hasUsableLocalE5Generation(g)) {
    return "NOT_CREATED";
  }

  if (!isLocalE5Complete(input)) {
    if (g!.status === "READY" || g!.status === "INDEXING") {
      return "CREATE_FAILED";
    }
    return "NOT_CREATED";
  }

  return resolveValidatedOrCreated(input, g!);
}

export function isSearchDataRankingPolicyStale(
  state: SearchDataUiState,
  evaluationRankingPolicyVersion: string | null | undefined,
): boolean {
  return (
    state === "VALIDATED" &&
    evaluationRankingPolicyVersion !== RETRIEVAL_RANKING_POLICY_VERSION
  );
}

export function canGenerateSearchData(input: {
  packStatusIsDraft: boolean;
  structurePassed: boolean;
  pipelineCurrent: boolean;
  state: SearchDataUiState;
}): boolean {
  return (
    input.packStatusIsDraft &&
    input.structurePassed &&
    input.pipelineCurrent &&
    (input.state === "NOT_CREATED" ||
      input.state === "CREATE_FAILED" ||
      input.state === "VALIDATION_FAILED")
  );
}

export function canValidateSearchDataState(input: {
  packStatusIsDraft: boolean;
  state: SearchDataUiState;
  rankingPolicyStale: boolean;
  localE5Complete: boolean;
}): boolean {
  return (
    input.packStatusIsDraft &&
    (input.state === "CREATED" ||
      input.state === "VALIDATION_FAILED" ||
      input.rankingPolicyStale) &&
    input.localE5Complete
  );
}

export function canRunServiceValidationForSearchData(input: {
  packStatusIsDraft: boolean;
  state: SearchDataUiState;
  rankingPolicyStale: boolean;
  generationStatus: string | null | undefined;
  serviceChannelsReady: boolean;
}): boolean {
  return (
    input.packStatusIsDraft &&
    input.state === "VALIDATED" &&
    !input.rankingPolicyStale &&
    input.generationStatus === "READY" &&
    input.serviceChannelsReady
  );
}
