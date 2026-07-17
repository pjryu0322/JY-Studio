import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import { resolveEmbeddingProviderAdapterForDescriptor } from "@/lib/embedding/embedding-provider-registry";
import { embedText } from "@/lib/embedding-service";
import { prisma } from "@/lib/prisma";
import { loadSearchGeneration } from "@/lib/search-generation/search-generation-service";
import { loadSearchIndexVectorsByChunkIds } from "@/lib/search-vector/search-vector-query";
import { clampedCosineSimilarity, isValidVector } from "@/lib/vector-similarity";
import { HYBRID_WEIGHTS } from "./retrieval-config";
import type { ScoredCandidate } from "./retrieval-types";

/**
 * hybrid vector ranking: query가 있을 때만 호출된다.
 * - embedding이 있는 chunk에만 vector similarity를 가산한다.
 * - embedding이 없는 chunk는 keyword/metadata score만으로 ranking된다. (fallback)
 * - embedding 미생성 상태에서도 실패하지 않는다.
 * scored 배열을 in-place로 갱신하고 사용한 embedding provider/model을 반환한다.
 *
 * P5: when `searchIndexGenerationId` is given, vectors are preferentially loaded
 * from the pgvector-backed SearchIndexVector table, ALWAYS scoped to that generation.
 * If pgvector is unavailable there: production throws SEARCH_RUNTIME_UNAVAILABLE (no
 * silent fallback — surfaced by loadSearchIndexVectorsByChunkIds itself); development/
 * test fall back to the JSON KnowledgeChunkEmbedding path using the generation's own
 * descriptor. When no generation id is given (legacy / non-generation packs), behavior
 * is unchanged from pre-P5 (local-hash JSON embeddings only).
 */
export async function applyHybridVectorRanking(input: {
  scored: ScoredCandidate[];
  searchQuery: string;
  searchIndexGenerationId?: string | null;
}): Promise<{ embeddingProvider?: string; embeddingModel?: string }> {
  const { scored, searchQuery, searchIndexGenerationId } = input;
  if (scored.length === 0) return {};
  const chunkIds = scored.map((item) => item.chunk.id);

  if (searchIndexGenerationId) {
    const generation = await loadSearchGeneration(searchIndexGenerationId);
    if (generation) {
      const descriptor = {
        provider: generation.embeddingProvider,
        model: generation.embeddingModel,
        dimension: generation.embeddingDimension,
      };
      const adapter = resolveEmbeddingProviderAdapterForDescriptor(descriptor);
      const queryEmbedding = await adapter.embed({ text: searchQuery });

      const vectorMap = await loadSearchIndexVectorsByChunkIds({
        searchIndexGenerationId,
        provider: descriptor.provider,
        model: descriptor.model,
        chunkIds,
      });
      if (vectorMap) {
        applyVectorScores(scored, queryEmbedding.vector, vectorMap);
        return { embeddingProvider: descriptor.provider, embeddingModel: descriptor.model };
      }

      // vectorMap === null: pgvector unavailable (development/test only — production
      // already threw SEARCH_RUNTIME_UNAVAILABLE inside loadSearchIndexVectorsByChunkIds).
      // Fall back to the JSON KnowledgeChunkEmbedding rows dual-written for this
      // generation's own descriptor (not necessarily local-hash).
      const jsonEmbeddings = await prisma.knowledgeChunkEmbedding.findMany({
        where: {
          chunkId: { in: chunkIds },
          provider: descriptor.provider,
          model: descriptor.model,
          searchIndexGenerationId,
        },
        select: { chunkId: true, vector: true },
      });
      const jsonVectorByChunk = new Map<string, number[]>();
      for (const row of jsonEmbeddings) {
        if (isValidVector(row.vector)) jsonVectorByChunk.set(row.chunkId, row.vector);
      }
      applyVectorScores(scored, queryEmbedding.vector, jsonVectorByChunk);
      return { embeddingProvider: descriptor.provider, embeddingModel: descriptor.model };
    }
  }

  // Legacy / fallback path — generation-agnostic local-hash JSON embeddings.
  const embeddingProvider = DEFAULT_EMBEDDING_PROVIDER;
  const embeddingModel = DEFAULT_EMBEDDING_MODEL;

  const queryEmbedding = embedText({ text: searchQuery });
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
  return { embeddingProvider, embeddingModel };
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
    const vectorScore = similarity * HYBRID_WEIGHTS.vector;
    item.vectorSimilarity = similarity;
    item.vectorScore = vectorScore;
    item.score += vectorScore;
    if (similarity > 0) {
      item.matchReasons.push("vector:similarity");
    }
  }
}
