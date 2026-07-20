import type { SearchIndexGeneration } from "@prisma/client";
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import type {
  EmbeddingDescriptor,
  EmbeddingProviderAdapter,
} from "@/lib/embedding/embedding-provider-adapter";
import { resolveEmbeddingProviderAdapterForDescriptor } from "@/lib/embedding/embedding-provider-registry";
import { embedText } from "@/lib/embedding-service";
import { prisma } from "@/lib/prisma";
import type { RetrievalFilters } from "@/lib/retrieval-dto";
import { matchesAllMetadataFilters, scoreRetrievalChunk } from "@/lib/retrieval-ranking";
import { resolveChunkGenerationId } from "@/lib/search-generation/search-generation-binding";
import {
  loadSearchIndexVectorsByChunkIds,
  querySearchIndexVectorsByGeneration,
  type SearchVectorQueryResult,
} from "@/lib/search-vector/search-vector-query";
import { clampedCosineSimilarity, isValidVector } from "@/lib/vector-similarity";
import { requireSearchGeneration } from "./hybrid-generation-guard";
import {
  HYBRID_WEIGHTS,
  MAX_HYBRID_CANDIDATES,
  resolveVectorCandidateTopK,
} from "./retrieval-config";
import {
  toMetadataRecord,
  type CandidateChunk,
  type ScoredCandidate,
} from "./retrieval-types";

export type ApplyHybridVectorRankingInput = {
  scored: ScoredCandidate[];
  searchQuery: string;
  searchIndexGenerationId?: string | null;
  /** Required for vector-only hydration (generation path). */
  versionId?: string;
  filters?: RetrievalFilters;
  topK?: number;
  /** Chunk-generation binding used by candidate collection (metadata.indexGenerationId). */
  indexGenerationId?: string | null;
  excludeDraftScope?: boolean;
  /** Optional tokenize tokens for keyword scoring of hydrated vector-only chunks. */
  tokens?: string[];
  /**
   * Test injection: override Generation lookup (default: requireSearchGeneration).
   * Production callers must not pass this.
   */
  requireGeneration?: (id: string) => Promise<SearchIndexGeneration>;
  /**
   * Test injection: override adapter resolution so embed() can be spied without a live worker.
   */
  resolveAdapter?: (descriptor: EmbeddingDescriptor) => EmbeddingProviderAdapter;
  /**
   * Test injection: override the pgvector query used on the generation path
   * (default: querySearchIndexVectorsByGeneration). Production callers must not pass this.
   */
  queryVectorsByGeneration?: typeof querySearchIndexVectorsByGeneration;
};

export type ApplyHybridVectorRankingResult = {
  scored: ScoredCandidate[];
  embeddingProvider?: string;
  embeddingModel?: string;
};

/**
 * hybrid vector ranking: query가 있을 때만 호출된다.
 *
 * P5.2.2 generation path:
 *  - searchIndexGenerationId set → Generation must resolve (fail-closed); never legacy
 *  1) Query Embedding 1회
 *  2) pgvector Cosine Top-K (Keyword 후보와 독립)
 *  3) Keyword ∪ Vector candidate union + vector-only hydration
 *  4) Metadata filter on vector-only rows
 *  5) Same query vector로 재점수화 (추가 embed 금지)
 *
 * Legacy/no-generation pack only when searchIndexGenerationId is null from the start.
 * Generation lookup failure is not legacy.
 */
export async function applyHybridVectorRanking(
  input: ApplyHybridVectorRankingInput,
): Promise<ApplyHybridVectorRankingResult> {
  const { scored, searchQuery, searchIndexGenerationId } = input;
  if (scored.length === 0 && !searchIndexGenerationId) return { scored };

  if (searchIndexGenerationId) {
    const requireGeneration = input.requireGeneration ?? requireSearchGeneration;
    const generation = await requireGeneration(searchIndexGenerationId);

    const descriptor = {
      provider: generation.embeddingProvider,
      model: generation.embeddingModel,
      modelRevision: generation.embeddingModelRevision,
      dimension: generation.embeddingDimension,
    };
    const resolveAdapter =
      input.resolveAdapter ?? resolveEmbeddingProviderAdapterForDescriptor;
    const adapter = resolveAdapter(descriptor);
    const queryEmbedding = await adapter.embed({ text: searchQuery });
    const queryVector = queryEmbedding.vector;
    const topK = input.topK ?? 10;
    const vectorTopK = resolveVectorCandidateTopK(topK);
    const filters = input.filters ?? {};
    const tokens = input.tokens ?? [];

    const queryVectorsByGeneration =
      input.queryVectorsByGeneration ?? querySearchIndexVectorsByGeneration;
    const vectorHits = await queryVectorsByGeneration({
      searchIndexGenerationId,
      provider: descriptor.provider,
      model: descriptor.model,
      queryVector,
      dimension: descriptor.dimension,
      limit: vectorTopK,
    });

    if (vectorHits) {
      const merged = await mergeKeywordAndVectorCandidates({
        scored,
        vectorHits,
        versionId: input.versionId,
        searchIndexGenerationId,
        chunkGenerationId: generation.chunkGenerationId,
        indexGenerationId: input.indexGenerationId,
        excludeDraftScope: input.excludeDraftScope,
        filters,
        tokens,
      });
      await applyVectorScoresPreferringHits({
        scored: merged,
        queryVector,
        vectorHits,
        searchIndexGenerationId,
        provider: descriptor.provider,
        model: descriptor.model,
      });
      return {
        scored: merged.slice(0, MAX_HYBRID_CANDIDATES),
        embeddingProvider: descriptor.provider,
        embeddingModel: descriptor.model,
      };
    }

    // vectorHits === null: pgvector unavailable (development/test only).
    // Fall back to generation-scoped JSON KnowledgeChunkEmbedding rows.
    // Still not legacy local-hash — scoped to this generation's descriptor.
    const chunkIds = scored.map((item) => item.chunk.id);
    const jsonVectorByChunk = new Map<string, number[]>();
    if (chunkIds.length > 0) {
      // Querying with an empty `in` filter is always empty, so skip the round trip.
      const jsonEmbeddings = await prisma.knowledgeChunkEmbedding.findMany({
        where: {
          chunkId: { in: chunkIds },
          provider: descriptor.provider,
          model: descriptor.model,
          searchIndexGenerationId,
        },
        select: { chunkId: true, vector: true },
      });
      for (const row of jsonEmbeddings) {
        if (isValidVector(row.vector)) jsonVectorByChunk.set(row.chunkId, row.vector);
      }
    }
    applyVectorScores(scored, queryVector, jsonVectorByChunk);
    return {
      scored,
      embeddingProvider: descriptor.provider,
      embeddingModel: descriptor.model,
    };
  }

  // Legacy/no-generation pack only — searchIndexGenerationId was null from the start.
  // Generation lookup failure must never reach here.
  if (scored.length === 0) return { scored };
  const embeddingProvider = DEFAULT_EMBEDDING_PROVIDER;
  const embeddingModel = DEFAULT_EMBEDDING_MODEL;

  const queryEmbedding = embedText({ text: searchQuery });
  const chunkIds = scored.map((item) => item.chunk.id);
  const embeddings = await prisma.knowledgeChunkEmbedding.findMany({
    where: { chunkId: { in: chunkIds }, provider: embeddingProvider, model: embeddingModel },
    select: { chunkId: true, vector: true },
  });
  const vectorByChunk = new Map<string, number[]>();
  for (const row of embeddings) {
    if (isValidVector(row.vector)) {
      vectorByChunk.set(row.chunkId, row.vector);
    }
  }

  applyVectorScores(scored, queryEmbedding.vector, vectorByChunk);
  return { scored, embeddingProvider, embeddingModel };
}

/** Pure helper: union keyword scored rows with vector hit ids (for unit tests). */
export function unionCandidateChunkIds(
  keywordChunkIds: string[],
  vectorChunkIds: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...keywordChunkIds, ...vectorChunkIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function mergeKeywordAndVectorCandidates(input: {
  scored: ScoredCandidate[];
  vectorHits: SearchVectorQueryResult[];
  versionId?: string;
  searchIndexGenerationId: string;
  chunkGenerationId: string;
  indexGenerationId?: string | null;
  excludeDraftScope?: boolean;
  filters: RetrievalFilters;
  tokens: string[];
}): Promise<ScoredCandidate[]> {
  const byId = new Map(input.scored.map((item) => [item.chunk.id, item]));
  const missingIds = input.vectorHits
    .map((hit) => hit.chunkId)
    .filter((id) => !byId.has(id));

  if (missingIds.length > 0 && input.versionId) {
    const hydrated = await hydrateVectorOnlyCandidates({
      chunkIds: missingIds,
      versionId: input.versionId,
      chunkGenerationId: input.chunkGenerationId,
      indexGenerationId: input.indexGenerationId,
      excludeDraftScope: input.excludeDraftScope,
      filters: input.filters,
      tokens: input.tokens,
    });
    for (const item of hydrated) {
      byId.set(item.chunk.id, item);
    }
  }

  // Preserve keyword order first, then append vector-only in hit order.
  const ordered: ScoredCandidate[] = [];
  const emitted = new Set<string>();
  for (const item of input.scored) {
    ordered.push(item);
    emitted.add(item.chunk.id);
  }
  for (const hit of input.vectorHits) {
    if (emitted.has(hit.chunkId)) continue;
    const item = byId.get(hit.chunkId);
    if (!item) continue;
    ordered.push(item);
    emitted.add(hit.chunkId);
  }
  return ordered;
}

async function hydrateVectorOnlyCandidates(input: {
  chunkIds: string[];
  versionId: string;
  chunkGenerationId: string;
  indexGenerationId?: string | null;
  excludeDraftScope?: boolean;
  filters: RetrievalFilters;
  tokens: string[];
}): Promise<ScoredCandidate[]> {
  if (input.chunkIds.length === 0) return [];
  const rows = await prisma.knowledgeChunk.findMany({
    where: {
      id: { in: input.chunkIds },
      versionId: input.versionId,
    },
    include: { sourceDocument: true },
  });

  const out: ScoredCandidate[] = [];
  for (const chunk of rows as CandidateChunk[]) {
    if (!passesGenerationIsolation(chunk, input)) continue;
    const metadataRecord = toMetadataRecord(chunk.metadata);
    if (!matchesAllMetadataFilters(metadataRecord, input.filters)) continue;

    const scored = scoreRetrievalChunk({
      chunk: { ...chunk, metadata: metadataRecord },
      tokens: input.tokens,
      filters: input.filters,
    });
    out.push({
      chunk,
      metadataRecord,
      keywordScore: scored.keywordScore,
      metadataScore: scored.metadataScore,
      vectorScore: 0,
      vectorSimilarity: 0,
      score: scored.score,
      matchReasons: [...scored.matchReasons],
    });
  }
  return out;
}

function passesGenerationIsolation(
  chunk: CandidateChunk,
  input: {
    chunkGenerationId: string;
    indexGenerationId?: string | null;
    excludeDraftScope?: boolean;
  },
): boolean {
  const chunkGen = resolveChunkGenerationId(chunk);
  if (chunkGen !== input.chunkGenerationId) return false;

  const meta = toMetadataRecord(chunk.metadata);
  if (input.indexGenerationId) {
    if (meta?.indexGenerationId !== input.indexGenerationId) return false;
  }
  if (input.excludeDraftScope) {
    if (meta?.indexScope === "DRAFT") return false;
    if (meta?.indexScope != null) {
      return meta.indexScope === "PRODUCTION" && meta.indexStatus === "APPROVED";
    }
  }
  return true;
}

async function applyVectorScoresPreferringHits(input: {
  scored: ScoredCandidate[];
  queryVector: number[];
  vectorHits: SearchVectorQueryResult[];
  searchIndexGenerationId: string;
  provider: string;
  model: string;
}): Promise<void> {
  const hitSimilarity = new Map(input.vectorHits.map((hit) => [hit.chunkId, hit.score]));
  const missingForLoad: string[] = [];

  for (const item of input.scored) {
    const fromHit = hitSimilarity.get(item.chunk.id);
    if (typeof fromHit === "number") {
      applySimilarityToCandidate(item, fromHit);
      continue;
    }
    missingForLoad.push(item.chunk.id);
  }

  if (missingForLoad.length === 0) return;

  const vectorMap = await loadSearchIndexVectorsByChunkIds({
    searchIndexGenerationId: input.searchIndexGenerationId,
    provider: input.provider,
    model: input.model,
    chunkIds: missingForLoad,
  });
  if (!vectorMap) return;
  applyVectorScores(
    input.scored.filter((item) => missingForLoad.includes(item.chunk.id)),
    input.queryVector,
    vectorMap,
  );
}

function applySimilarityToCandidate(item: ScoredCandidate, similarity: number): void {
  const clamped = Math.max(0, Math.min(1, similarity));
  const vectorScore = clamped * HYBRID_WEIGHTS.vector;
  item.vectorSimilarity = clamped;
  item.vectorScore = vectorScore;
  item.score += vectorScore;
  if (clamped > 0) {
    item.matchReasons.push("vector:similarity");
  }
}

function applyVectorScores(
  scored: ScoredCandidate[],
  queryVector: number[],
  vectorByChunk: Map<string, number[]>,
): void {
  for (const item of scored) {
    const chunkVector = vectorByChunk.get(item.chunk.id);
    if (!chunkVector) {
      // embedding이 없는 candidate는 keyword/metadata score로 fallback한다.
      continue;
    }
    const similarity = clampedCosineSimilarity(queryVector, chunkVector);
    applySimilarityToCandidate(item, similarity);
  }
}
