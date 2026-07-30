import { PUBLIC_PACK_STATUSES } from "@/lib/knowledge-pack-public";

// P13.2: 후보 수집 paging 상수. filter가 있을 때 앞쪽 500개 밖 조건 누락을 완화한다.
export const CANDIDATE_PAGE_SIZE = 500;
export const MAX_CANDIDATE_SCAN = 5000;
/** Lexical candidate budget (title/content prefilter). */
export const MAX_FILTERED_CANDIDATES = 1000;
export const LEXICAL_CANDIDATE_LIMIT = MAX_FILTERED_CANDIDATES;

// P5.2.1: pgvector Cosine Top-K candidate pool (independent of keyword scan).
export const VECTOR_CANDIDATE_MULTIPLIER = 5;
export const VECTOR_CANDIDATE_MIN = 20;
export const VECTOR_CANDIDATE_MAX = 200;
export const VECTOR_CANDIDATE_LIMIT = VECTOR_CANDIDATE_MAX;

/** Deduped keyword ∪ vector candidate cap after union. */
export const MAX_HYBRID_CANDIDATES = MAX_FILTERED_CANDIDATES + VECTOR_CANDIDATE_MAX;
export const UNION_CANDIDATE_LIMIT = MAX_HYBRID_CANDIDATES;

// P14: hybrid ranking 가중치. keyword/metadata score에 vector similarity를 결합한다.
export const HYBRID_WEIGHTS = {
  keyword: 1,
  metadata: 1,
  vector: 100,
} as const;

// 공개 pack status 기준(PUBLISHED / VERIFIED). Retrieval API의 기존 기준을 재사용한다.
export { PUBLIC_PACK_STATUSES };

/** Resolves how many pgvector Top-K hits to fetch for one hybrid request. */
export function resolveVectorCandidateTopK(topK: number): number {
  const safeTopK = Number.isFinite(topK) ? Math.max(1, Math.trunc(topK)) : 1;
  return Math.min(
    Math.max(safeTopK * VECTOR_CANDIDATE_MULTIPLIER, VECTOR_CANDIDATE_MIN),
    VECTOR_CANDIDATE_MAX,
  );
}
