import type {
  RetrievalFilters,
  RetrievalMode,
  RetrievalResponseDto,
} from "@/lib/retrieval-dto";
import { tokenizeSearchQuery } from "@/lib/search-utils";
import { applyHybridVectorRanking } from "@/lib/retrieval/hybrid-ranking-service";
import { collectRetrievalCandidates } from "@/lib/retrieval/retrieval-candidate-store";
import { loadPublicRetrievalPack } from "@/lib/retrieval/retrieval-pack-store";
import {
  mapRetrievalResponse,
  selectRetrievalCandidates,
} from "@/lib/retrieval/retrieval-response-mapper";
import { scoreRetrievalCandidates } from "@/lib/retrieval/retrieval-score-service";

/**
 * Retrieval orchestration facade.
 * 1) 공개 pack + 최신 version 조회
 * 2) query tokenize / filter key 판정
 * 3) candidate 수집(paging, metadata AND filter)
 * 4) keyword/metadata scoring
 * 5) hybrid vector ranking (query가 있을 때만)
 * 6) selection + response DTO mapping
 */
export async function retrieveContexts(input: {
  knowledgePackId: string;
  query?: string;
  filters: RetrievalFilters;
  topK: number;
  includeMetadata: boolean;
  retrievalMode: RetrievalMode;
  requestId: string;
}): Promise<RetrievalResponseDto | null> {
  const packContext = await loadPublicRetrievalPack(input.knowledgePackId);
  if (!packContext) {
    return null;
  }

  const searchQuery = input.query?.trim() ?? "";
  const tokens = tokenizeSearchQuery(searchQuery);
  const filterKeys = Object.keys(input.filters);
  const hasFilters = filterKeys.length > 0;
  const hasQuery = tokens.length > 0;

  // metadata filter는 항상 vector/hybrid ranking보다 먼저 적용된다.
  // query-only/hybrid 검색도 첫 500개에 한정하지 않고 paging scan한다.
  const { collected, scanned, collectionMode } = await collectRetrievalCandidates({
    versionId: packContext.versionId,
    filters: input.filters,
    hasFilters,
    hasQuery,
  });

  const scored = scoreRetrievalCandidates({
    candidates: collected,
    tokens,
    filters: input.filters,
  });

  // hybrid mode: query가 있으면 vector similarity를 결합한다.
  const useHybrid = input.retrievalMode === "hybrid" && tokens.length > 0;
  let embeddingProvider: string | undefined;
  let embeddingModel: string | undefined;
  if (useHybrid) {
    const hybrid = await applyHybridVectorRanking({ scored, searchQuery });
    embeddingProvider = hybrid.embeddingProvider;
    embeddingModel = hybrid.embeddingModel;
  }

  const selected = selectRetrievalCandidates({
    scored,
    hasFilters,
    hasQuery,
    topK: input.topK,
  });

  return mapRetrievalResponse({
    selected,
    packId: packContext.packId,
    includeMetadata: input.includeMetadata,
    useHybrid,
    topK: input.topK,
    filters: input.filters,
    requestId: input.requestId,
    embeddingProvider,
    embeddingModel,
    scanned,
    filteredCount: collected.length,
    collectionMode,
  });
}
