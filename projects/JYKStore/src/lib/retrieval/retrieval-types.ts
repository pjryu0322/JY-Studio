import type { KnowledgeChunk, SourceDocument } from "@prisma/client";
import type { CandidateCollectionMode, RetrievalFilters } from "@/lib/retrieval-dto";

// 후보 chunk: sourceDocument include 포함.
export type CandidateChunk = KnowledgeChunk & { sourceDocument: SourceDocument | null };

export type CandidateCollectInput = {
  versionId: string;
  filters: RetrievalFilters;
  hasFilters: boolean;
  hasQuery: boolean;
};

export type CandidateCollectResult = {
  collected: CandidateChunk[];
  scanned: number;
  collectionMode: CandidateCollectionMode;
};

export type ScoredCandidate = {
  chunk: CandidateChunk;
  metadataRecord: Record<string, unknown> | null;
  keywordScore: number;
  metadataScore: number;
  vectorScore: number;
  vectorSimilarity: number;
  score: number;
  matchReasons: string[];
};

export type RetrievalPackContext = {
  packId: string;
  versionId: string;
};

export function toMetadataRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
