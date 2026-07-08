import type { SearchScoreReason } from "@/lib/search-utils";

export const DEFAULT_TOP_K = 8;
export const MIN_TOP_K = 1;
export const MAX_TOP_K = 20;

export const RETRIEVAL_QUERY_MAX_LENGTH = 2000;

export function validateRetrievalQueryLength(
  query: unknown,
): { ok: true; query: string | undefined } | { ok: false; error: string } {
  if (query === undefined || query === null) {
    return { ok: true, query: undefined };
  }
  if (typeof query !== "string") {
    return { ok: false, error: "query must be a string." };
  }
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: true, query: undefined };
  }
  if (trimmed.length > RETRIEVAL_QUERY_MAX_LENGTH) {
    return {
      ok: false,
      error: `query must be at most ${RETRIEVAL_QUERY_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, query: trimmed };
}

export const CANONICAL_FILTER_KEYS = [
  "category",
  "feature",
  "apiName",
  "documentType",
  "securityLevel",
  "environment",
  "framework",
  "programmingLanguage",
  "productName",
  "productVersion",
  "sourceOrganization",
  "licenseType",
  "verificationStatus",
  "releaseVersion",
  "referenceType",
] as const;

export type CanonicalFilterKey = (typeof CANONICAL_FILTER_KEYS)[number];

export const FILTER_KEY_ALIASES: Record<string, CanonicalFilterKey> = {
  language: "programmingLanguage",
  version: "productVersion",
};

export const ALLOWED_FILTER_KEYS = new Set<string>([
  ...CANONICAL_FILTER_KEYS,
  ...Object.keys(FILTER_KEY_ALIASES),
]);

export type RetrievalFilters = Partial<Record<CanonicalFilterKey, string>>;

export type RetrievalMode = "keyword" | "hybrid";

export const RETRIEVAL_MODES: RetrievalMode[] = ["keyword", "hybrid"];

export type RetrievalRequestBody = {
  knowledgePackId?: string;
  query?: string;
  filters?: Record<string, unknown>;
  topK?: number;
  includeMetadata?: boolean;
  retrievalMode?: RetrievalMode;
};

export type RetrievalReference = {
  type: string;
  title: string;
  sourceDocumentId: string;
};

export type RetrievalScoreDetail = {
  keywordScore: number;
  metadataScore: number;
  vectorScore: number;
  vectorSimilarity: number;
};

export type RetrievalContextDto = {
  chunkId: string;
  knowledgePackId: string;
  title: string;
  content: string;
  score: number;
  matchReasons: string[];
  metadata?: Record<string, unknown>;
  scoreDetail?: RetrievalScoreDetail;
  references?: RetrievalReference[];
};

export type CandidateCollectionMode = "default-page" | "metadata-filter" | "query-scan";

export type RetrievalResponseDto = {
  contexts: RetrievalContextDto[];
  usage: {
    requestId: string;
    contextCount: number;
    topK: number;
    usedFilters: RetrievalFilters;
    retrievalMode: RetrievalMode;
    embeddingProvider?: string;
    embeddingModel?: string;
    scannedCandidateCount: number;
    filteredCandidateCount: number;
    candidateCollectionMode: CandidateCollectionMode;
  };
};

export type RetrievalScoreReason = SearchScoreReason;
