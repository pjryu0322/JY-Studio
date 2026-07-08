export type ChunkQualityStatus = "PASS" | "WARNING" | "FAIL";

export type ChunkQualityIssueSeverity = "BLOCKER" | "WARNING";

export type ChunkQualityIssueDraft = {
  severity: ChunkQualityIssueSeverity;
  code: string;
  message: string;
  field?: string | null;
  hint?: string | null;
};

export type ChunkQualitySourceDocumentInput = {
  id: string;
  sourceType: string;
  validationStatus: string;
};

export type ChunkQualityChunkInput = {
  id: string;
  sourceDocumentId: string | null;
  chunkType: string;
  title: string;
  content: string;
  section: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  isActive: boolean;
};

export type ChunkQualityStructureSectionInput = {
  sectionKey: string;
  title: string;
  required: boolean;
  covered: boolean;
  matchedDocIds: string[];
  matchedSignals: string[];
};

export type ChunkQualityChunkMetricDraft = {
  chunkId: string;
  sourceDocumentId: string | null;
  title: string;
  contentLength: number;
  tokenEstimate: number;
  status: ChunkQualityStatus;
  score: number;
  issues: string[];
};

export type ChunkQualityRunResult = {
  status: ChunkQualityStatus;
  totalScore: number;
  coverageScore: number;
  traceabilityScore: number;
  sizeScore: number;
  duplicateScore: number;
  metadataScore: number;
  structureAlignmentScore: number;
  activeChunkCount: number;
  inactiveChunkCount: number;
  sourceDocumentCount: number;
  coveredSourceDocumentCount: number;
  orphanChunkCount: number;
  missingSourceChunkCount: number;
  shortChunkCount: number;
  longChunkCount: number;
  duplicateChunkCount: number;
  chunkWithoutMetadataCount: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  summary: string;
  issues: ChunkQualityIssueDraft[];
  metrics: ChunkQualityChunkMetricDraft[];
};
