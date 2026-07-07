import { scoreKnowledgeChunk } from "@/lib/chunk-search-service";
import {
  CANONICAL_FILTER_KEYS,
  FILTER_KEY_ALIASES,
  type CanonicalFilterKey,
  type RetrievalFilters,
} from "@/lib/retrieval-dto";
import { normalizeSearchText } from "@/lib/search-utils";

const METADATA_WEIGHTS = {
  exact: 10,
  insensitive: 10,
  arrayInclude: 10,
  substring: 5,
  aliasBonus: 8,
} as const;

type KeywordScorableChunk = Parameters<typeof scoreKnowledgeChunk>[0];

const CANONICAL_TO_ALIASES: Partial<Record<CanonicalFilterKey, string[]>> = (() => {
  const map: Partial<Record<CanonicalFilterKey, string[]>> = {};
  for (const [alias, canonical] of Object.entries(FILTER_KEY_ALIASES)) {
    (map[canonical] ??= []).push(alias);
  }
  return map;
})();

function readMetadataValue(
  metadata: Record<string, unknown>,
  key: CanonicalFilterKey,
): { value: unknown; viaAlias: boolean } | null {
  if (metadata[key] !== undefined && metadata[key] !== null) {
    return { value: metadata[key], viaAlias: false };
  }
  for (const alias of CANONICAL_TO_ALIASES[key] ?? []) {
    if (metadata[alias] !== undefined && metadata[alias] !== null) {
      return { value: metadata[alias], viaAlias: true };
    }
  }
  return null;
}

function matchSingleValue(candidate: string, filterValue: string): number {
  if (candidate === filterValue) return METADATA_WEIGHTS.exact;
  const nc = normalizeSearchText(candidate);
  const nf = normalizeSearchText(filterValue);
  if (!nf) return 0;
  if (nc === nf) return METADATA_WEIGHTS.insensitive;
  if (nc.includes(nf)) return METADATA_WEIGHTS.substring;
  return 0;
}

function matchMetadataField(value: unknown, filterValue: string): number {
  if (Array.isArray(value)) {
    let best = 0;
    for (const item of value) {
      if (typeof item !== "string") continue;
      const nc = normalizeSearchText(item);
      const nf = normalizeSearchText(filterValue);
      if (nc && nc === nf) {
        best = Math.max(best, METADATA_WEIGHTS.arrayInclude);
      } else if (nc && nf && nc.includes(nf)) {
        best = Math.max(best, METADATA_WEIGHTS.substring);
      }
    }
    return best;
  }
  if (typeof value === "string") {
    return matchSingleValue(value, filterValue);
  }
  return 0;
}

export function scoreMetadata(
  metadata: Record<string, unknown> | null | undefined,
  filters: RetrievalFilters,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (!metadata) return { score: 0, reasons };

  let score = 0;
  for (const key of CANONICAL_FILTER_KEYS) {
    const filterValue = filters[key];
    if (!filterValue) continue;

    const read = readMetadataValue(metadata, key);
    if (!read) continue;

    const matchScore = matchMetadataField(read.value, filterValue);
    if (matchScore <= 0) continue;

    score += matchScore;
    if (read.viaAlias) {
      score += METADATA_WEIGHTS.aliasBonus;
    }
    reasons.push(`metadata:${key}`);
  }

  return { score, reasons };
}

export function matchesMetadataFilterValue(value: unknown, filterValue: string): boolean {
  return matchMetadataField(value, filterValue) > 0;
}

export function matchesAllMetadataFilters(
  metadata: Record<string, unknown> | null | undefined,
  filters: RetrievalFilters,
): boolean {
  const activeKeys = CANONICAL_FILTER_KEYS.filter((key) => Boolean(filters[key]));
  if (activeKeys.length === 0) return true;
  if (!metadata) return false;

  for (const key of activeKeys) {
    const filterValue = filters[key]!;
    const read = readMetadataValue(metadata, key);
    if (!read) return false;
    if (!matchesMetadataFilterValue(read.value, filterValue)) return false;
  }

  return true;
}

export function scoreRetrievalChunk(input: {
  chunk: KeywordScorableChunk & { metadata?: Record<string, unknown> | null };
  tokens: string[];
  filters: RetrievalFilters;
}): { score: number; keywordScore: number; metadataScore: number; matchReasons: string[] } {
  const keyword = scoreKnowledgeChunk(input.chunk, input.tokens);
  const metadata = scoreMetadata(input.chunk.metadata, input.filters);

  const keywordReasons = Array.from(
    new Set(keyword.matchReasons.map((reason) => `query:${reason.token}`)),
  );

  const recencyScore = 0;
  const score = keyword.score + metadata.score + recencyScore;

  return {
    score,
    keywordScore: keyword.score,
    metadataScore: metadata.score,
    matchReasons: [...keywordReasons, ...metadata.reasons],
  };
}
