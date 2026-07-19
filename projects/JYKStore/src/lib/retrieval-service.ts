import { prisma } from "@/lib/prisma";
import type {
  RetrievalFilters,
  RetrievalMode,
  RetrievalResponseDto,
} from "@/lib/retrieval-dto";
import { tokenizeSearchQuery } from "@/lib/search-utils";
import {
  applyHybridVectorRanking,
  type ApplyHybridVectorRankingInput,
} from "@/lib/retrieval/hybrid-ranking-service";
import { collectRetrievalCandidates } from "@/lib/retrieval/retrieval-candidate-store";
import {
  mapRetrievalResponse,
  selectRetrievalCandidatesWithStats,
} from "@/lib/retrieval/retrieval-response-mapper";
import { scoreRetrievalCandidates } from "@/lib/retrieval/retrieval-score-service";
import type { RetrievalEvaluationCandidate } from "@/lib/retrieval-evaluation/retrieval-evaluation-types";
import { toMetadataRecord } from "@/lib/retrieval/retrieval-types";

/**
 * Retrieval orchestration facade.
 * 1) 공개 pack + 최신 version 조회
 * 2) Capability(retrieval READY) 확인
 * 3) query tokenize / filter key 판정
 * 4) candidate 수집(paging, metadata AND filter)
 * 5) keyword/metadata scoring
 * 6) hybrid vector ranking (query가 있을 때만)
 * 7) selection + response DTO mapping
 */
export type RetrieveContextsResult =
  | { ok: true; data: RetrievalResponseDto }
  | { ok: false; code: "PACK_NOT_FOUND" }
  | { ok: false; code: "PACK_RETRIEVAL_NOT_READY" }
  | { ok: false; code: "SERVICE_CHANNEL_DISABLED"; message: string }
  | { ok: false; code: "SERVICE_ENDED"; message: string }
  | { ok: false; code: "SEARCH_RUNTIME_UNAVAILABLE"; message: string };

export async function retrieveContexts(input: {
  knowledgePackId: string;
  query?: string;
  filters: RetrievalFilters;
  topK: number;
  includeMetadata: boolean;
  retrievalMode: RetrievalMode;
  requestId: string;
  /** @deprecated Fixed by route — callers must not pass client-controlled values. */
  serviceChannel?: "API" | "MCP";
}): Promise<RetrieveContextsResult> {
  const { executeRetrievalApiRequest } = await import("@/lib/retrieval/retrieval-api-adapter");
  const result = await executeRetrievalApiRequest({
    knowledgePackId: input.knowledgePackId,
    query: input.query,
    filters: input.filters,
    topK: input.topK,
    includeMetadata: input.includeMetadata,
    retrievalMode: input.retrievalMode,
    requestId: input.requestId,
    serviceChannel: input.serviceChannel ?? "API",
    executionMode: "PUBLIC",
  });
  if (!result.ok) {
    if (result.code === "PACK_NOT_FOUND") return { ok: false, code: "PACK_NOT_FOUND" };
    if (result.code === "PACK_RETRIEVAL_NOT_READY") {
      return { ok: false, code: "PACK_RETRIEVAL_NOT_READY" };
    }
    if (result.code === "SERVICE_CHANNEL_DISABLED" || result.code === "SERVICE_ENDED") {
      return {
        ok: false,
        code: result.code as "SERVICE_CHANNEL_DISABLED" | "SERVICE_ENDED",
        message: result.message,
      };
    }
    if (result.code === "SEARCH_RUNTIME_UNAVAILABLE" || result.code === "SEARCH_GENERATION_NOT_READY") {
      return { ok: false, code: "SEARCH_RUNTIME_UNAVAILABLE", message: result.message };
    }
    return { ok: false, code: "PACK_NOT_FOUND" };
  }
  return { ok: true, data: result.data };
}

export async function retrieveContextsForVersion(input: {
  packId: string;
  versionId: string;
  query?: string;
  filters: RetrievalFilters;
  topK: number;
  includeMetadata: boolean;
  retrievalMode: RetrievalMode;
  requestId: string;
  indexGenerationId?: string | null;
  excludeDraftScope?: boolean;
  /** P5: search generation to scope candidate/vector lookups to, when resolved. */
  searchIndexGenerationId?: string | null;
  /**
   * @internal Test-only hooks for hybrid ranking (adapter/generation injection).
   * Production callers must not pass this.
   */
  hybridTestHooks?: Pick<ApplyHybridVectorRankingInput, "requireGeneration" | "resolveAdapter">;
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
    indexGenerationId: input.indexGenerationId,
    excludeDraftScope: input.excludeDraftScope,
  });

  const scored = scoreRetrievalCandidates({
    candidates: collected,
    tokens,
    filters: input.filters,
  });

  const useHybrid = input.retrievalMode === "hybrid" && tokens.length > 0;
  let embeddingProvider: string | undefined;
  let embeddingModel: string | undefined;
  let hybridScored = scored;
  if (useHybrid) {
    const hybrid = await applyHybridVectorRanking({
      scored,
      searchQuery,
      searchIndexGenerationId: input.searchIndexGenerationId,
      versionId: input.versionId,
      filters: input.filters,
      topK: input.topK,
      indexGenerationId: input.indexGenerationId,
      excludeDraftScope: input.excludeDraftScope,
      tokens,
      ...(input.hybridTestHooks ?? {}),
    });
    hybridScored = hybrid.scored;
    embeddingProvider = hybrid.embeddingProvider;
    embeddingModel = hybrid.embeddingModel;
  }

  const { selected } = selectRetrievalCandidatesWithStats({
    scored: hybridScored,
    hasFilters,
    hasQuery,
    topK: input.topK,
    query: searchQuery,
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
    filteredCount: hybridScored.length,
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
  indexGenerationId?: string | null;
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
    indexGenerationId: input.indexGenerationId,
    excludeDraftScope: false,
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
