import type { SourceFormat, SourceType, SourceValidationStatus } from "@prisma/client";

export type ValidationSeverity = "BLOCKER" | "WARNING" | "INFO";

export type ValidationIssueDraft = {
  severity: ValidationSeverity;
  code: string;
  message: string;
  field?: string;
  hint?: string;
};

export type SourceValidationDocumentInput = {
  title: string;
  sourceType: SourceType;
  sourceFormat: SourceFormat;
  content?: string | null;
  sourceUrl?: string | null;
  productVersion?: string | null;
  checksum?: string | null;
};

export type SourceValidationContext = {
  packId: string;
  versionId: string;
  siblingChecksums?: string[];
};

export type SourceValidationRunResult = {
  status: SourceValidationStatus;
  score: number;
  summary: string;
  issues: ValidationIssueDraft[];
  issueCount: number;
  blockingIssueCount: number;
  warningIssueCount: number;
};
