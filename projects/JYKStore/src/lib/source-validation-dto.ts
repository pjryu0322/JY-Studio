export type SourceValidationIssueDto = {
  id: string;
  severity: string;
  code: string;
  message: string;
  field: string | null;
  hint: string | null;
};

export type SourceValidationReportDto = {
  id: string;
  sourceDocumentId: string;
  packId: string;
  versionId: string;
  sourceType: string;
  sourceFormat: string;
  status: string;
  score: number;
  summary: string;
  issueCount: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  checkedBy: string;
  checkedAt: string;
  issues: SourceValidationIssueDto[];
};

export type SourceDocumentValidationSummaryDto = {
  sourceDocumentId: string;
  latestReport: SourceValidationReportDto | null;
};
