import type { RetrievalEvaluationFreshnessSnapshot } from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";

export type RetrievalEvaluationIssueDto = {
  severity: string;
  code: string;
  message: string;
  field: string | null;
  hint: string | null;
};

export type RetrievalEvaluationModeCountDto = {
  pass: number;
  warning: number;
  fail: number;
};

export type RetrievalEvaluationFailedResultDto = {
  caseId: string;
  retrievalMode: string;
  query: string;
  status: string;
  issueCodes: string[];
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
  hitRate: number;
  meanReciprocalRank: number;
  averageTopRank: number | null;
  averageScore: number;
  totalScore: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  summary: string;
  checkedBy: string;
  checkedAt: string;
  issues: RetrievalEvaluationIssueDto[];
  modeSummary?: {
    keyword: RetrievalEvaluationModeCountDto;
    hybrid: RetrievalEvaluationModeCountDto;
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
