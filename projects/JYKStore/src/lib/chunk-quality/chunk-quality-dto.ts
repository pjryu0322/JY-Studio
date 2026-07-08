import type { ChunkQualityFreshnessSnapshot } from "@/lib/chunk-quality/chunk-quality-freshness";

export type ChunkQualityIssueDto = {
  severity: string;
  code: string;
  message: string;
  field: string | null;
  hint: string | null;
};

export type ChunkQualityChunkMetricDto = {
  chunkId: string | null;
  sourceDocumentId: string | null;
  title: string | null;
  contentLength: number;
  tokenEstimate: number;
  status: string;
  score: number;
  issues: string[];
};

export type ChunkQualityReportDto = {
  id: string;
  packId: string;
  versionId: string;
  status: string;
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
  checkedAt: string;
  issues: ChunkQualityIssueDto[];
  metrics: ChunkQualityChunkMetricDto[];
};

export type ChunkQualitySummaryDto = {
  report: ChunkQualityReportDto | null;
  freshness: ChunkQualityFreshnessSnapshot;
};
