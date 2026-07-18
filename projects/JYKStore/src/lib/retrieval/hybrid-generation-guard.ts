import type { SearchIndexGeneration } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  loadSearchGeneration,
  type SearchGenerationClient,
} from "@/lib/search-generation/search-generation-service";

/**
 * Fail-closed lookup for hybrid retrieval.
 * A non-null searchIndexGenerationId must resolve to a usable Generation —
 * never fall through to legacy local-hash.
 */
export async function requireSearchGeneration(
  searchIndexGenerationId: string,
  client?: SearchGenerationClient,
): Promise<SearchIndexGeneration> {
  const generation = await loadSearchGeneration(searchIndexGenerationId, client);
  if (!generation) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_READY",
      "검색 Generation을 확인할 수 없습니다.",
      503,
    );
  }

  if (generation.id !== searchIndexGenerationId) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_READY",
      "검색 Generation 식별자가 일치하지 않습니다.",
      503,
    );
  }

  if (!generation.embeddingProvider?.trim() || !generation.embeddingModel?.trim()) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_READY",
      "검색 Generation Embedding Descriptor가 불완전합니다.",
      503,
    );
  }

  if (
    !generation.embeddingModelRevision?.trim() ||
    typeof generation.embeddingDimension !== "number" ||
    generation.embeddingDimension <= 0
  ) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_READY",
      "검색 Generation Embedding Descriptor가 불완전합니다.",
      503,
    );
  }

  return generation;
}
