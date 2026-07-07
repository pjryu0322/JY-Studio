import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import { embedText } from "@/lib/embedding-service";
import { prisma } from "@/lib/prisma";
import { clampedCosineSimilarity, isValidVector } from "@/lib/vector-similarity";
import { HYBRID_WEIGHTS } from "./retrieval-config";
import type { ScoredCandidate } from "./retrieval-types";

/**
 * hybrid vector ranking: query가 있을 때만 호출된다.
 * - embedding이 있는 chunk에만 vector similarity를 가산한다.
 * - embedding이 없는 chunk는 keyword/metadata score만으로 ranking된다. (fallback)
 * - embedding 미생성 상태에서도 실패하지 않는다.
 * - 외부 embedding API 호출 없이 local-hash provider(embedText)만 사용한다.
 * scored 배열을 in-place로 갱신하고 사용한 embedding provider/model을 반환한다.
 */
export async function applyHybridVectorRanking(input: {
  scored: ScoredCandidate[];
  searchQuery: string;
}): Promise<{ embeddingProvider?: string; embeddingModel?: string }> {
  const { scored, searchQuery } = input;
  if (scored.length === 0) return {};

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

  for (const item of scored) {
    const chunkVector = vectorByChunk.get(item.chunk.id);
    if (!chunkVector) {
      // embedding이 없는 candidate는 keyword/metadata score로 fallback한다.
      continue;
    }
    const similarity = clampedCosineSimilarity(queryEmbedding.vector, chunkVector);
    const vectorScore = similarity * HYBRID_WEIGHTS.vector;
    item.vectorSimilarity = similarity;
    item.vectorScore = vectorScore;
    item.score += vectorScore;
    if (similarity > 0) {
      item.matchReasons.push("vector:similarity");
    }
  }

  return { embeddingProvider, embeddingModel };
}
