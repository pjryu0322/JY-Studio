import type {
  CandidateCollectionMode,
  RetrievalContextDto,
  RetrievalFilters,
  RetrievalResponseDto,
} from "@/lib/retrieval-dto";
import {
  selectDiverseTopK,
  type RerankStats,
} from "./relevance-diversity-rerank";
import type { ScoredCandidate } from "./retrieval-types";

function byScore(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.chunk.sortOrder !== b.chunk.sortOrder) return a.chunk.sortOrder - b.chunk.sortOrder;
  return a.chunk.createdAt.getTime() - b.chunk.createdAt.getTime();
}

/**
 * selection 규칙:
 * - filters가 있으면 score가 0이어도 filter 통과 chunk를 포함하고 score로 정렬한다.
 * - filters가 없고 query가 있으면 score > 0인 chunk만 반환한다.
 * - filters/query 모두 없으면 sortOrder/createdAt 순서를 그대로 사용한다.
 * - query가 있으면 관련도 우선 + 중복 제거·다양화 후 topK.
 */
export function selectRetrievalCandidates(input: {
  scored: ScoredCandidate[];
  hasFilters: boolean;
  hasQuery: boolean;
  topK: number;
  query?: string;
}): ScoredCandidate[] {
  return selectRetrievalCandidatesWithStats(input).selected;
}

export function selectRetrievalCandidatesWithStats(input: {
  scored: ScoredCandidate[];
  hasFilters: boolean;
  hasQuery: boolean;
  topK: number;
  query?: string;
}): { selected: ScoredCandidate[]; stats: RerankStats | null } {
  const { scored, hasFilters, hasQuery, topK } = input;
  const query = input.query?.trim() ?? "";

  let pool = scored;
  if (hasFilters) {
    pool = [...scored].sort(byScore);
  } else if (hasQuery) {
    pool = scored.filter((item) => item.score > 0).sort(byScore);
  } else {
    return {
      selected: pool.slice(0, topK),
      stats: null,
    };
  }

  if (hasQuery && query) {
    const diversified = selectDiverseTopK({ scored: pool, query, topK });
    return { selected: diversified.selected, stats: diversified.stats };
  }

  return {
    selected: pool.slice(0, topK),
    stats: null,
  };
}

export function mapRetrievalResponse(input: {
  selected: ScoredCandidate[];
  packId: string;
  includeMetadata: boolean;
  useHybrid: boolean;
  topK: number;
  filters: RetrievalFilters;
  requestId: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  vectorBackend?: "pgvector" | "json_fallback" | "none";
  vectorCandidateCount?: number;
  queryEmbeddingLatencyMs?: number;
  vectorQueryLatencyMs?: number;
  scanned: number;
  filteredCount: number;
  collectionMode: CandidateCollectionMode;
}): RetrievalResponseDto {
  const contexts: RetrievalContextDto[] = input.selected.map((item) => {
    const context: RetrievalContextDto = {
      chunkId: item.chunk.id,
      knowledgePackId: input.packId,
      title: item.chunk.title,
      content: item.chunk.content,
      score: item.score,
      matchReasons: item.matchReasons,
    };

    if (input.includeMetadata) {
      context.metadata = item.metadataRecord ?? {};
    }

    if (input.useHybrid) {
      context.scoreDetail = {
        keywordScore: item.keywordScore,
        metadataScore: item.metadataScore,
        vectorScore: item.vectorScore,
        vectorSimilarity: item.vectorSimilarity,
      };
    }

    if (item.chunk.sourceDocument) {
      context.references = [
        {
          type: "SOURCE_DOCUMENT",
          title: item.chunk.sourceDocument.title,
          sourceDocumentId: item.chunk.sourceDocument.id,
        },
      ];
    }

    return context;
  });

  return {
    contexts,
    usage: {
      requestId: input.requestId,
      contextCount: contexts.length,
      topK: input.topK,
      usedFilters: input.filters,
      retrievalMode: input.useHybrid ? "hybrid" : "keyword",
      embeddingProvider: input.embeddingProvider,
      embeddingModel: input.embeddingModel,
      ...(input.useHybrid
        ? {
            vectorBackend: input.vectorBackend,
            vectorCandidateCount: input.vectorCandidateCount,
            queryEmbeddingLatencyMs: input.queryEmbeddingLatencyMs,
            vectorQueryLatencyMs: input.vectorQueryLatencyMs,
          }
        : {}),
      scannedCandidateCount: input.scanned,
      filteredCandidateCount: input.filteredCount,
      candidateCollectionMode: input.collectionMode,
    },
  };
}
