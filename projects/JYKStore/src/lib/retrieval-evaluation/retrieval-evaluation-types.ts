export type RetrievalEvaluationStatus = "PASS" | "WARNING" | "FAIL";

export type RetrievalEvaluationCaseMode = "both" | "keyword" | "hybrid";

export type RetrievalEvaluationCaseInput = {
  id: string;
  query: string;
  mode: RetrievalEvaluationCaseMode;
  topK: number;
  expectedChunkIds: string[];
  expectedSourceDocumentIds: string[];
  expectedSections: string[];
  expectedTags: string[];
  expectedMetadata: Record<string, unknown> | null;
  weight: number;
};

export type RetrievalEvaluationCandidate = {
  chunkId: string;
  sourceDocumentId: string | null;
  title: string;
  section: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  score: number;
};

export type RetrievalEvaluationIssueDraft = {
  severity: "BLOCKER" | "WARNING";
  code: string;
  message: string;
  field?: string | null;
  hint?: string | null;
};

export type RetrievalEvaluationCaseResultDraft = {
  caseId: string;
  retrievalMode: "keyword" | "hybrid";
  query: string;
  status: RetrievalEvaluationStatus;
  topK: number;
  hit: boolean;
  firstHitRank: number | null;
  reciprocalRank: number;
  bestScore: number;
  matchedChunkIds: string[];
  matchedSourceIds: string[];
  returnedChunkIds: string[];
  returnedSourceIds: string[];
  issueCodes: string[];
};

export type RetrievalEvaluationRunAggregate = {
  status: RetrievalEvaluationStatus;
  retrievalMode: "mixed" | "keyword" | "hybrid";
  totalCaseCount: number;
  evaluatedCaseCount: number;
  passCaseCount: number;
  warningCaseCount: number;
  failCaseCount: number;
  hitRate: number;
  meanReciprocalRank: number;
  caseHitRate: number;
  caseMeanReciprocalRank: number;
  evaluatedResultCount: number;
  passResultCount: number;
  warningResultCount: number;
  failResultCount: number;
  resultHitRate: number;
  resultMeanReciprocalRank: number;
  modeMetrics: {
    keyword: RetrievalEvaluationModeMetric;
    hybrid: RetrievalEvaluationModeMetric;
  };
  averageTopRank: number | null;
  averageScore: number;
  totalScore: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  summary: string;
  issues: RetrievalEvaluationIssueDraft[];
  results: RetrievalEvaluationCaseResultDraft[];
};

export type RetrievalEvaluationModeMetric = {
  evaluatedResultCount: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  hitRate: number;
  meanReciprocalRank: number;
  averageTopRank: number | null;
  averageScore: number;
};

export type RetrievalEvaluationResultAggregate = {
  evaluatedResultCount: number;
  passResultCount: number;
  warningResultCount: number;
  failResultCount: number;
  resultHitRate: number;
  resultMeanReciprocalRank: number;
};

export const MIN_RETRIEVAL_EVAL_CASES = 5;
export const RECOMMENDED_RETRIEVAL_EVAL_CASES = 10;
export const MAX_AUTO_RETRIEVAL_EVAL_CASES = 30;

export type GeneratedRetrievalCase = {
  query: string;
  mode: RetrievalEvaluationCaseMode;
  topK: number;
  expectedChunkIds: string[];
  expectedSourceDocumentIds: string[];
  expectedSections: string[];
  expectedTags: string[];
  expectedMetadata: Record<string, unknown> | null;
  weight: number;
};

export type StructureSectionForCaseGen = {
  sectionKey: string;
  title: string;
  required: boolean;
  covered: boolean;
  matchedDocIds: string[];
  matchedSignals: string[];
};

export type SourceDocForCaseGen = {
  id: string;
  title: string;
  sourceType: string;
  validationStatus: string;
};

export type ChunkForCaseGen = {
  id: string;
  title: string;
  section: string | null;
  tags: string[];
  sourceDocumentId: string | null;
  isActive: boolean;
  sourceType?: string | null;
};
