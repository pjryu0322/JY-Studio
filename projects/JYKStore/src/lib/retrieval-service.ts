import { prisma } from "@/lib/prisma";
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
import type { RetrievalEvaluationCandidate } from "@/lib/retrieval-evaluation/retrieval-evaluation-types";
import { toMetadataRecord } from "@/lib/retrieval/retrieval-types";

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

  return retrieveContextsForVersion({
    packId: packContext.packId,
    versionId: packContext.versionId,
    query: input.query,
    filters: input.filters,
    topK: input.topK,
    includeMetadata: input.includeMetadata,
    retrievalMode: input.retrievalMode,
    requestId: input.requestId,
  });
}

async function retrieveContextsForVersion(input: {
  packId: string;
  versionId: string;
  query?: string;
  filters: RetrievalFilters;
  topK: number;
  includeMetadata: boolean;
  retrievalMode: RetrievalMode;
  requestId: string;
}): Promise<RetrievalResponseDto> {
  const searchQuery = input.query?.trim() ?? "";
  const tokens = tokenizeSearchQuery(searchQuery);
  const filterKeys = Object.keys(input.filters);
  const hasFilters = filterKeys.length > 0;
  const hasQuery = tokens.length > 0;

  const { collected, scanned, collectionMode } = await collectRetrievalCandidates({
    versionId: input.versionId,
    filters: input.filters,
    hasFilters,
    hasQuery,
  });

  const scored = scoreRetrievalCandidates({
    candidates: collected,
    tokens,
    filters: input.filters,
  });

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
    packId: input.packId,
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

/**
 * Internal retrieval for evaluation gates. Works for DRAFT/REVIEWING packs
 * (not limited to public statuses). Does not change public API response shape.
 */
export async function runRetrievalForEvaluation(input: {
  knowledgePackId: string;
  versionId: string;
  query: string;
  retrievalMode: RetrievalMode;
  topK: number;
}): Promise<RetrievalEvaluationCandidate[]> {
  const response = await retrieveContextsForVersion({
    packId: input.knowledgePackId,
    versionId: input.versionId,
    query: input.query,
    filters: {},
    topK: input.topK,
    includeMetadata: true,
    retrievalMode: input.retrievalMode,
    requestId: `eval-${Date.now()}`,
  });

  const chunkIds = response.contexts.map((c) => c.chunkId);
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { id: { in: chunkIds } },
    select: {
      id: true,
      section: true,
      tags: true,
      sourceDocumentId: true,
      metadata: true,
    },
  });
  const byId = new Map(chunks.map((c) => [c.id, c]));

  return response.contexts.map((ctx) => {
    const chunk = byId.get(ctx.chunkId);
    const refSourceId = ctx.references?.[0]?.sourceDocumentId ?? null;
    return {
      chunkId: ctx.chunkId,
      sourceDocumentId: chunk?.sourceDocumentId ?? refSourceId,
      title: ctx.title,
      section: chunk?.section ?? null,
      tags: chunk?.tags ?? [],
      metadata: toMetadataRecord(chunk?.metadata) ?? ctx.metadata ?? null,
      score: ctx.score,
    };
  });
}
