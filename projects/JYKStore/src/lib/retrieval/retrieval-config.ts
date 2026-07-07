import { PUBLIC_PACK_STATUSES } from "@/lib/knowledge-pack-public";

// P13.2: 후보 수집 paging 상수. filter가 있을 때 앞쪽 500개 밖 조건 누락을 완화한다.
export const CANDIDATE_PAGE_SIZE = 500;
export const MAX_CANDIDATE_SCAN = 5000;
export const MAX_FILTERED_CANDIDATES = 1000;

// P14: hybrid ranking 가중치. keyword/metadata score에 vector similarity를 결합한다.
export const HYBRID_WEIGHTS = {
  keyword: 1,
  metadata: 1,
  vector: 100,
} as const;

// 공개 pack status 기준(PUBLISHED / VERIFIED). Retrieval API의 기존 기준을 재사용한다.
export { PUBLIC_PACK_STATUSES };
