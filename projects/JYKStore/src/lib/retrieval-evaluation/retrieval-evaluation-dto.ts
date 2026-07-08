import type { RetrievalEvaluationFreshnessSnapshot } from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";

export type RetrievalEvaluationIssueDto = {
  severity: string;
  code: string;
  message: string;
  field: string | null;
  hint: string | null;
};

export type RetrievalEvaluationModeSummaryDto = {
  evaluatedResultCount: number;
  pass: number;
  warning: number;
  fail: number;
  hitRate: number;
  meanReciprocalRank: number;
  averageTopRank: number | null;
  averageScore: number;
};

export type RetrievalEvaluationFailedResultDto = {
  caseId: string;
  retrievalMode: string;
  query: string;
  status: string;
  issueCodes: string[];
  firstHitRank?: number | null;
  hit?: boolean;
};

export type RetrievalEvaluationRunDto = {
  id: string;
  setId: string;
  packId: string;
  versionId: string;
  status: string;
  retrievalMode: string;
  totalCaseCount: number;
  evaluatedCaseCount: number;
  passCaseCount: number;
  warningCaseCount: number;
  failCaseCount: number;
  /** Case-level hit rate (same as caseHitRate). */
  hitRate: number;
  /** Case-level MRR (same as caseMeanReciprocalRank). */
  meanReciprocalRank: number;
  caseHitRate: number;
  caseMeanReciprocalRank: number;
  evaluatedResultCount: number;
  passResultCount: number;
  warningResultCount: number;
  failResultCount: number;
  resultHitRate: number;
  resultMeanReciprocalRank: number;
  averageTopRank: number | null;
  averageScore: number;
  totalScore: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  summary: string;
  checkedBy: string;
  checkedAt: string;
  issues: RetrievalEvaluationIssueDto[];
  modeSummary: {
    keyword: RetrievalEvaluationModeSummaryDto;
    hybrid: RetrievalEvaluationModeSummaryDto;
  };
  failedResults?: RetrievalEvaluationFailedResultDto[];
};

export type RetrievalEvaluationSetSummaryDto = {
  id: string;
  name: string;
  activeCaseCount: number;
  updatedAt: string;
};

export type RetrievalEvaluationSummaryDto = {
  set: RetrievalEvaluationSetSummaryDto | null;
  latestRun: RetrievalEvaluationRunDto | null;
  freshness: RetrievalEvaluationFreshnessSnapshot;
};
