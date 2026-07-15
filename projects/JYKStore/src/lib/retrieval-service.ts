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
import { assertServiceChannelEnabled } from "@/lib/distribution/service-channel-policy";

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
  | { ok: false; code: "SERVICE_ENDED"; message: string };

export async function retrieveContexts(input: {
  knowledgePackId: string;
  query?: string;
  filters: RetrievalFilters;
  topK: number;
  includeMetadata: boolean;
  retrievalMode: RetrievalMode;
  requestId: string;
  /** Public API defaults to API; MCP bridge passes MCP. */
  serviceChannel?: "API" | "MCP";
}): Promise<RetrieveContextsResult> {
  const packContext = await loadPublicRetrievalPack(input.knowledgePackId);
  if (!packContext) {
    return { ok: false, code: "PACK_NOT_FOUND" };
  }

  const channel = input.serviceChannel ?? "API";
  const channelCheck = assertServiceChannelEnabled(channel, {
    allowApi: packContext.allowApi,
    allowMcp: packContext.allowMcp,
    allowDownload: packContext.allowDownload,
    serviceEndsAt: packContext.serviceEndsAt,
  });
  if (!channelCheck.ok) {
    return {
      ok: false,
      code: channelCheck.code as "SERVICE_CHANNEL_DISABLED" | "SERVICE_ENDED",
      message: channelCheck.message,
    };
  }

  const activeChunkCount = await prisma.knowledgeChunk.count({
    where: {
      versionId: packContext.versionId,
      isActive: true,
    },
  });
  if (activeChunkCount < 1) {
    return { ok: false, code: "PACK_RETRIEVAL_NOT_READY" };
  }

  const data = await retrieveContextsForVersion({
    packId: packContext.packId,
    versionId: packContext.versionId,
    query: input.query,
    filters: input.filters,
    topK: input.topK,
    includeMetadata: input.includeMetadata,
    retrievalMode: input.retrievalMode,
    requestId: input.requestId,
    excludeDraftScope: true,
  });
  return { ok: true, data };
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
  indexGenerationId?: string | null;
  excludeDraftScope?: boolean;
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
