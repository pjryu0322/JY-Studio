/**
 * Search-data UI status types (provider 검색검증).
 * Public response shape must stay stable for routes/components.
 */

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
  /** True when VALIDATED but evaluation used an outdated ranking policy. */
  rankingPolicyStale: boolean;
  currentRankingPolicyVersion: string;
  evaluatedRankingPolicyVersion: string | null;
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

export const SEARCH_DATA_LOCAL_E5_PROVIDER = "local-e5";
