// P5: resolves which SearchIndexGeneration a retrieval request must be scoped to.
//
// - PUBLIC / MCP traffic must only ever be served from the PRODUCTION + PROMOTED
//   generation. Packs that never adopted the search-generation pipeline (no
//   SearchIndexGeneration rows at all for the version) keep their pre-P5 behavior
//   (isActive chunks, no generation filter) so this is purely additive.
// - PROVIDER_VALIDATION traffic must be served from the DRAFT + READY generation
//   that matches the caller-resolved indexGenerationId/chunkGenerationId binding.

import { prisma } from "@/lib/prisma";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  loadCurrentDraftSearchGeneration,
  loadProductionSearchGeneration,
} from "@/lib/search-generation/search-generation-service";

export type RetrievalGenerationScope = {
  searchIndexGenerationId: string | null;
  indexGenerationId: string | null;
};

const EMPTY_SCOPE: RetrievalGenerationScope = { searchIndexGenerationId: null, indexGenerationId: null };

export async function resolvePublicRetrievalGenerationScope(
  versionId: string,
): Promise<RetrievalGenerationScope> {
  const anyGeneration = await prisma.searchIndexGeneration.findFirst({
    where: { versionId },
    select: { id: true },
  });
  if (!anyGeneration) return EMPTY_SCOPE;

  const production = await loadProductionSearchGeneration(versionId);
  if (!production) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_READY",
      "운영으로 승격된 검색 세대가 없어 공개 검색을 제공할 수 없습니다.",
      503,
    );
  }
  return { searchIndexGenerationId: production.id, indexGenerationId: production.chunkGenerationId };
}

export async function resolveProviderValidationGenerationScope(input: {
  versionId: string;
  indexGenerationId?: string | null;
}): Promise<RetrievalGenerationScope> {
  if (!input.indexGenerationId) return EMPTY_SCOPE;

  const draft = await loadCurrentDraftSearchGeneration(input.versionId);
  if (!draft || draft.chunkGenerationId !== input.indexGenerationId) {
    // No matching SearchIndexGeneration — legacy binding, fall back to the
    // caller-provided indexGenerationId (pre-P4 metadata-based filtering).
    return { searchIndexGenerationId: null, indexGenerationId: input.indexGenerationId };
  }
  if (draft.status !== "READY") {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_READY",
      "DRAFT 검색 세대가 READY 상태가 아니어서 검증할 수 없습니다.",
      409,
    );
  }
  return { searchIndexGenerationId: draft.id, indexGenerationId: draft.chunkGenerationId };
}
