import type { SearchScoreReason } from "@/lib/search-utils";

export const DEFAULT_TOP_K = 8;
export const MIN_TOP_K = 1;
export const MAX_TOP_K = 20;

export const RETRIEVAL_QUERY_MAX_LENGTH = 100;

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

export type RetrievalRequestBody = {
  knowledgePackId?: string;
  query?: string;
  filters?: Record<string, unknown>;
  topK?: number;
  includeMetadata?: boolean;
};

export type RetrievalReference = {
  type: string;
  title: string;
  sourceDocumentId: string;
};

export type RetrievalContextDto = {
  chunkId: string;
  knowledgePackId: string;
  title: string;
  content: string;
  score: number;
  matchReasons: string[];
  metadata?: Record<string, unknown>;
  references?: RetrievalReference[];
};

export type RetrievalResponseDto = {
  contexts: RetrievalContextDto[];
  usage: {
    requestId: string;
    contextCount: number;
    topK: number;
    usedFilters: RetrievalFilters;
  };
};

export type RetrievalScoreReason = SearchScoreReason;
